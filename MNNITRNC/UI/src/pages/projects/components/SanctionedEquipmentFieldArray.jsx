import { Box, TextField, IconButton, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export default function SanctionedEquipmentFieldArray({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { id: null, name: '', unit: '', amount: 0 }]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {items.map((item, index) => (
        <Stack key={index} direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
          <TextField label="Equipment Name" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} size="small" fullWidth />
          <TextField label="Unit" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} size="small" />
          <TextField label="Amount" type="number" value={item.amount} onChange={(e) => updateItem(index, 'amount', e.target.value)} size="small" />
          <IconButton onClick={() => removeItem(index)} aria-label="remove equipment">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={addItem} size="small">Add Equipment</Button>
    </Box>
  );
}
