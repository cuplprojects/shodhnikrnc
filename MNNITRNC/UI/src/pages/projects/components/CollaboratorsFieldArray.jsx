import { Box, TextField, IconButton, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export default function CollaboratorsFieldArray({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { id: null, institute: '', faculty: '' }]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {items.map((item, index) => (
        <Stack key={index} direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
          <TextField
            label="Institute"
            value={item.institute}
            onChange={(e) => updateItem(index, 'institute', e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Faculty Name"
            value={item.faculty}
            onChange={(e) => updateItem(index, 'faculty', e.target.value)}
            size="small"
            fullWidth
          />
          <IconButton onClick={() => removeItem(index)} aria-label="remove collaborator">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={addItem} size="small">Add Collaborator</Button>
    </Box>
  );
}
