import { Box, TextField, Select, MenuItem, FormControl, InputLabel, IconButton, Button, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { BUDGET_HEAD_NAMES } from '../../../constants/projectEnums';
import { formatCurrency } from '../utils/currency';

export default function BudgetHeadsFieldArray({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { id: null, headName: BUDGET_HEAD_NAMES[0].value, year1Amount: 0, year2Amount: 0, year3Amount: 0 }]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const rowTotal = (item) => Number(item.year1Amount || 0) + Number(item.year2Amount || 0) + Number(item.year3Amount || 0);

  return (
    <Box>
      {items.map((item, index) => (
        <Stack key={index} direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Budget Head</InputLabel>
            <Select
              label="Budget Head"
              value={item.headName}
              onChange={(e) => updateItem(index, 'headName', e.target.value)}
            >
              {BUDGET_HEAD_NAMES.map((h) => (
                <MenuItem key={h.value} value={h.value}>{h.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Year 1"
            type="number"
            value={item.year1Amount}
            onChange={(e) => updateItem(index, 'year1Amount', e.target.value)}
            size="small"
          />
          <TextField
            label="Year 2"
            type="number"
            value={item.year2Amount}
            onChange={(e) => updateItem(index, 'year2Amount', e.target.value)}
            size="small"
          />
          <TextField
            label="Year 3"
            type="number"
            value={item.year3Amount}
            onChange={(e) => updateItem(index, 'year3Amount', e.target.value)}
            size="small"
          />
          <Typography variant="body2" sx={{ minWidth: 120 }}>{formatCurrency(rowTotal(item))}</Typography>
          <IconButton onClick={() => removeItem(index)} aria-label="remove budget head">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={addItem} size="small">Add Budget Head</Button>
    </Box>
  );
}
