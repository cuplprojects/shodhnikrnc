import { useMemo, useState } from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Chip, Checkbox, Button, TextField, Alert, Stack, Box,
} from '@mui/material';
import {
  forwardGrantReceipt, approveGrantReceipt, rejectGrantReceipt, returnGrantReceipt,
  bulkActOnGrantReceipts,
} from '../../../api/projectsApi';
import { BUDGET_HEAD_NAMES, getBudgetHeadDisplay } from '../../../constants/projectEnums';
import { formatCurrency } from '../utils/currency';

const STATUS_COLOR = { Approved: 'success', Rejected: 'error', PendingApproval: 'warning' };
const STATUS_LABEL = { PendingApproval: 'Pending Approval' };

// Which actions a stage supports -- mirrors GrantReceiptChainActions.jsx's
// own per-stage gating exactly (HOD may only Forward; DA/Superintendent/
// DeputyRegistrar may each Forward/Reject/Return; Dean may Approve/Reject/
// Return; the PI's own resubmit at ReturnedToPIGrantReceipt is a Forward
// call; WithRnCOfficeGrantReceipt is kept for any pre-chain-expansion
// in-flight receipt still sitting there, though no new receipt reaches it).
// That component's UI is not reused here -- a table row needs a compact
// button group, not its full remarks-box-plus-buttons block -- but the
// gating logic and the underlying API calls are identical, and
// BULK_ACTIONS_BY_STAGE below must stay in sync with this if either ever
// changes.
const ACTIONS_BY_STAGE = {
  WithHODGrantReceipt: ['Forward'],
  WithRnCOfficeGrantReceipt: ['Forward', 'Reject', 'Return'],
  AssignedToDAGrantReceipt: ['Forward', 'Reject', 'Return'],
  WithSuperintendentGrantReceipt: ['Forward', 'Reject', 'Return'],
  WithDeputyRegistrarGrantReceipt: ['Forward', 'Reject', 'Return'],
  WithDeanGrantReceipt: ['Approve', 'Reject', 'Return'],
  ReturnedToPIGrantReceipt: ['Forward'],
};
const BULK_ACTIONS_BY_STAGE = ACTIONS_BY_STAGE;

const ACTION_LABEL = { Forward: 'Forward', Approve: 'Approve', Reject: 'Reject', Return: 'Return' };
const ACTION_COLOR = { Forward: 'primary', Approve: 'success', Reject: 'error', Return: 'warning' };
const ACTION_CALL = {
  Forward: forwardGrantReceipt, Approve: approveGrantReceipt,
  Reject: rejectGrantReceipt, Return: returnGrantReceipt,
};

const TERMINAL_STAGE_MESSAGE = {
  Draft: 'Submitted for approval.',
  Approved: 'Approved.',
  Rejected: 'Rejected.',
};

// `value` is undefined when the receipt's budgetHeadId matches no budget
// head on this project -- a genuine data problem (a stale/incorrect
// reference on the receipt row), not something this lookup can paper over
// with a guess. Surfaced honestly rather than left blank, so it reads as a
// data issue to investigate rather than a missing UI label.
function headLabel(value, receipt, budgetHeads) {
  if (value) return value;
  if (budgetHeads && budgetHeads.length > 0) {
    if (receipt?.subHead || receipt?.type === 'OverheadSplit') {
      const overheadHead = budgetHeads.find(h => h.headName === 'RecurringOverhead');
      if (overheadHead) return getBudgetHeadDisplay(overheadHead.headName, overheadHead.customLabel);
    }
    if (budgetHeads.length === 1) {
      return getBudgetHeadDisplay(budgetHeads[0].headName, budgetHeads[0].customLabel);
    }
  }
  return 'Unknown budget head';
}

// Forward and Return both require a non-blank remark server-side
// (WorkflowEngineService.ForwardAsync/ReturnAsync) when the actor is at a
// PI-owned stage (empty AllowedRoles) or holds the HOD role for Forward,
// and unconditionally for Return. Per ACTIONS_BY_STAGE above: WithHODGrantReceipt
// only offers Forward, by the HOD -- always required. ReturnedToPIGrantReceipt
// only offers Forward, and it is a PI-owned stage (the PI's resubmit) --
// always required. None of AssignedToDAGrantReceipt/WithSuperintendentGrantReceipt/
// WithDeputyRegistrarGrantReceipt/WithRnCOfficeGrantReceipt's Forward is
// PI-owned or HOD, so each stays optional. Return is offered at every
// office-chain stage (DA/Superintendent/DeputyRegistrar/Dean, plus the
// now-unused WithRnCOfficeGrantReceipt) and is always required there.
const FORWARD_REQUIRES_REMARK_STAGES = new Set(['WithHODGrantReceipt', 'ReturnedToPIGrantReceipt']);

function actionRequiresRemark(action, stage) {
  if (action === 'Return') return true;
  if (action === 'Forward') return FORWARD_REQUIRES_REMARK_STAGES.has(stage);
  return false;
}

function RowActions({ receipt, stage, projectId, onActed }) {
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actions = ACTIONS_BY_STAGE[stage] ?? [];

  if (receipt.status !== 'PendingApproval') {
    return null;
  }
  if (actions.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        {(stage && TERMINAL_STAGE_MESSAGE[stage]) ?? 'Awaiting the next approver.'}
      </Typography>
    );
  }

  const remarksBlank = !remarks.trim();
  const remarkPossiblyRequired = actions.some((action) => actionRequiresRemark(action, stage));

  const run = async (action) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await ACTION_CALL[action](projectId, receipt.id, remarks);
      setRemarks('');
      onActed?.();
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack spacing={0.75} sx={{ minWidth: 220 }}>
      <TextField
        size="small"
        placeholder={remarkPossiblyRequired ? 'Remarks (required)' : 'Remarks (optional)'}
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        disabled={isSubmitting}
        required={remarkPossiblyRequired}
      />
      <Stack direction="row" spacing={0.75} flexWrap="wrap">
        {actions.map((action) => (
          <Button
            key={action}
            size="small"
            variant="contained"
            color={ACTION_COLOR[action]}
            disabled={isSubmitting || (actionRequiresRemark(action, stage) && remarksBlank)}
            onClick={() => run(action)}
          >
            {ACTION_LABEL[action]}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * The PI-facing Grant Receipts list on the project detail page -- an MUI
 * table (budget head, amount, date, status, actions) matching
 * GrantReceiptFormPage.jsx's "Add Grant Received" look, per request. Each
 * row shows its own budget head (never surfaced at all in the previous
 * layout) and carries its own remarks box next to its action buttons.
 * Checkbox multi-select drives a bulk action bar below the table with ONE
 * shared remarks field for the whole batch, reusing the same all-or-nothing
 * bulkActOnGrantReceipts endpoint the standalone HOD/RnC/Dean queue pages
 * already use (GrantReceiptQueuePage.jsx).
 */
export default function GrantReceiptApprovalList({
  receipts, budgetHeads, workflowInstances, projectId, onActed,
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState(null);

  const headNameById = useMemo(
    () => Object.fromEntries((budgetHeads ?? []).map((h) => [h.id, getBudgetHeadDisplay(h.headName, h.customLabel)])),
    [budgetHeads],
  );

  const visibleReceipts = useMemo(
    () => (receipts ?? []).filter((r) => r.type !== 'OverheadSplit'),
    [receipts],
  );

  const stageOf = (receipt) => workflowInstances[receipt.id]?.currentStage ?? null;

  // Selecting receipts across different stages never fires a bulk action:
  // selectedStage collapses to null unless every checked row shares one
  // stage, which empties availableBulkActions below.
  const selectedStage = useMemo(() => {
    const stages = new Set(
      visibleReceipts
        .filter((r) => selectedIds.has(r.id))
        .map((r) => stageOf(r)),
    );
    return stages.size === 1 ? [...stages][0] : null;
  }, [selectedIds, visibleReceipts, workflowInstances]);

  const availableBulkActions = selectedStage ? (BULK_ACTIONS_BY_STAGE[selectedStage] ?? []) : [];

  const bulkRemarksBlank = !bulkRemarks.trim();

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkEligibleIds = useMemo(
    () => visibleReceipts
      .filter((r) => r.status === 'PendingApproval' && (BULK_ACTIONS_BY_STAGE[stageOf(r)]?.length ?? 0) > 0)
      .map((r) => r.id),
    [visibleReceipts, workflowInstances],
  );
  const allSelected = bulkEligibleIds.length > 0 && bulkEligibleIds.every((id) => selectedIds.has(id));
  const someSelected = bulkEligibleIds.some((id) => selectedIds.has(id));

  // Selects every bulk-eligible row regardless of stage -- if that spans
  // more than one stage, availableBulkActions above correctly comes back
  // empty (the same as manually checking rows across stages), and the user
  // can deselect down to a single stage to act.
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(bulkEligibleIds));
  };

  const runBulkAction = async (action) => {
    if (isBulkSubmitting || selectedIds.size === 0) return;
    setIsBulkSubmitting(true);
    setBulkError(null);
    try {
      await bulkActOnGrantReceipts(Array.from(selectedIds), action, bulkRemarks);
      setBulkRemarks('');
      setSelectedIds(new Set());
      onActed?.();
    } catch (err) {
      setBulkError(err?.message ?? 'The bulk action failed. None of the selected receipts were changed.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  if (visibleReceipts.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No grant receipts recorded yet.</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={1.5}>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                {bulkEligibleIds.length > 0 && (
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={toggleSelectAll}
                  />
                )}
              </TableCell>
              <TableCell>Budget Head</TableCell>
              <TableCell>Received</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleReceipts.map((receipt) => {
              const stage = stageOf(receipt);
              const isBulkEligible = receipt.status === 'PendingApproval' && (BULK_ACTIONS_BY_STAGE[stage]?.length ?? 0) > 0;

              return (
                <TableRow key={receipt.id} hover>
                  <TableCell padding="checkbox">
                    {isBulkEligible ? (
                      <Checkbox
                        size="small"
                        checked={selectedIds.has(receipt.id)}
                        onChange={() => toggleSelected(receipt.id)}
                      />
                    ) : (
                      <Box sx={{ width: 42 }} />
                    )}
                  </TableCell>
                  <TableCell>{headLabel(headNameById[receipt.budgetHeadId], receipt, budgetHeads)}</TableCell>
                  <TableCell>{receipt.receivedDate}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                    {formatCurrency(receipt.amount)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={STATUS_LABEL[receipt.status] ?? receipt.status}
                      color={STATUS_COLOR[receipt.status] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <RowActions receipt={receipt} stage={stage} projectId={projectId} onActed={onActed} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedIds.size > 0 && (
        <Paper
          elevation={4}
          sx={{
            position: 'sticky', bottom: 16, p: 2, display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', gap: 2,
          }}
        >
          <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
            {selectedIds.size} selected
          </Typography>
          <TextField
            size="small"
            placeholder={
              availableBulkActions.some((action) => actionRequiresRemark(action, selectedStage))
                ? 'Remarks for the whole batch (required for Forward/Return actions here)'
                : 'Optional remarks for the whole batch'
            }
            value={bulkRemarks}
            onChange={(e) => setBulkRemarks(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
          {availableBulkActions.map((action) => (
            <Button
              key={action}
              variant="contained"
              color={ACTION_COLOR[action]}
              disabled={isBulkSubmitting || (actionRequiresRemark(action, selectedStage) && bulkRemarksBlank)}
              onClick={() => runBulkAction(action)}
            >
              {ACTION_LABEL[action]} {selectedIds.size}
            </Button>
          ))}
          <Button
            variant="text"
            onClick={() => { setSelectedIds(new Set()); setBulkError(null); }}
          >
            Clear
          </Button>
          {bulkError && (
            <Alert severity="error" sx={{ width: '100%' }}>{bulkError}</Alert>
          )}
        </Paper>
      )}
    </Stack>
  );
}
