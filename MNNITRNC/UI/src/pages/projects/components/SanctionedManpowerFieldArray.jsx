import { Box, TextField, IconButton, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export default function SanctionedManpowerFieldArray({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { id: null, designation: '', positions: 1, stipend: 0, hra: 0 }]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {items.map((item, index) => (
        <Stack key={index} direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
          <TextField label="Designation" value={item.designation} onChange={(e) => updateItem(index, 'designation', e.target.value)} size="small" fullWidth />
          <TextField label="Positions" type="number" value={item.positions} onChange={(e) => updateItem(index, 'positions', e.target.value)} size="small" />
          <TextField label="Stipend" type="number" value={item.stipend} onChange={(e) => updateItem(index, 'stipend', e.target.value)} size="small" />
          <TextField label="HRA" type="number" value={item.hra} onChange={(e) => updateItem(index, 'hra', e.target.value)} size="small" />
          <IconButton onClick={() => removeItem(index)} aria-label="remove manpower position">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={addItem} size="small">Add Manpower Position</Button>
    </Box>
  );
}
