import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { VERSION, discoverDroids, getAvailableModels, saveDroid } from './models.js';

// Main app states
const STATE_LIST = 'list';
const STATE_PICKER = 'picker';
const STATE_PICKER_ALL = 'picker_all';

export default function App() {
  const { exit } = useApp();
  const [droids, setDroids] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [state, setState] = useState(STATE_LIST);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDroids(discoverDroids());
  }, []);

  const modifiedCount = droids.filter(d => d.model !== d.originalModel).length;

  // Build model picker items
  const { factory, byok } = getAvailableModels();
  const modelItems = [
    { label: '── Factory Models ──', value: '__header_factory__', disabled: true },
    ...factory.map(m => ({ 
      label: `  ${m}`, 
      value: `factory:${m}` 
    })),
  ];
  if (byok.length > 0) {
    modelItems.push({ label: '── BYOK Custom ──', value: '__header_byok__', disabled: true });
    modelItems.push(...byok.map(m => ({ 
      label: `  ${m}`, 
      value: `byok:${m}` 
    })));
  }

  // Filter out disabled items for SelectInput (it doesn't support disabled)
  const selectableModelItems = modelItems.filter(item => !item.disabled);

  useInput((input, key) => {
    if (state === STATE_LIST) {
      if (input === 'q') {
        if (modifiedCount > 0) {
          setMessage("Unsaved changes! Press 's' to save or 'q' again to force quit");
          // Next q will force quit
          return;
        }
        exit();
      }
      if (input === 's') {
        let saved = 0;
        for (const droid of droids) {
          if (droid.model !== droid.originalModel) {
            saveDroid(droid);
            saved++;
          }
        }
        setDroids([...droids]); // Force re-render
        setMessage(saved > 0 ? `Saved ${saved} droid(s)` : 'No changes to save');
      }
      if (input === 'a') {
        setState(STATE_PICKER_ALL);
      }
      if (input === 'i') {
        const updated = droids.map(d => ({ ...d, model: 'inherit' }));
        setDroids(updated);
        setMessage("All droids set to 'inherit'");
      }
      if (input === 'r') {
        setDroids(discoverDroids());
        setMessage('Reloaded from disk');
      }
      if (key.return && droids.length > 0) {
        setState(STATE_PICKER);
      }
      if ((key.downArrow || input === 'j') && selectedIndex < droids.length - 1) {
        setSelectedIndex(selectedIndex + 1);
        setMessage('');
      }
      if ((key.upArrow || input === 'k') && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
        setMessage('');
      }
    }
    
    if ((state === STATE_PICKER || state === STATE_PICKER_ALL) && key.escape) {
      setState(STATE_LIST);
    }
  });

  const handleModelSelect = (item) => {
    // Strip prefix
    let model = item.value;
    if (model.startsWith('factory:') || model.startsWith('byok:')) {
      model = model.split(':')[1];
    }

    if (state === STATE_PICKER) {
      const updated = [...droids];
      updated[selectedIndex] = { ...updated[selectedIndex], model };
      setDroids(updated);
      setMessage(`Set ${droids[selectedIndex].name} to '${model}'`);
    } else if (state === STATE_PICKER_ALL) {
      const updated = droids.map(d => ({ ...d, model }));
      setDroids(updated);
      setMessage(`All droids set to '${model}'`);
    }
    setState(STATE_LIST);
  };

  // Render model picker
  if (state === STATE_PICKER || state === STATE_PICKER_ALL) {
    const title = state === STATE_PICKER 
      ? `Model for ${droids[selectedIndex]?.name}` 
      : 'Set ALL droids to:';
    
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">{title}</Text>
        <Text dimColor>Use ↑↓/j/k to navigate, Enter to select, Esc to cancel</Text>
        <Box marginTop={1}>
          <SelectInput
            items={selectableModelItems}
            onSelect={handleModelSelect}
          />
        </Box>
      </Box>
    );
  }

  // Main list view
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Droid Model Tuner v{VERSION}</Text>
      </Box>

      {/* Header */}
      <Box>
        <Box width={32}><Text bold color="gray">Name</Text></Box>
        <Box width={26}><Text bold color="gray">Model</Text></Box>
        <Box width={10}><Text bold color="gray">Location</Text></Box>
        <Box width={10}><Text bold color="gray">Status</Text></Box>
      </Box>

      {/* Droid list */}
      {droids.map((droid, index) => {
        const isSelected = index === selectedIndex;
        const isModified = droid.model !== droid.originalModel;
        return (
          <Box key={droid.name}>
            <Box width={32}>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                {isSelected ? '> ' : '  '}{droid.name}
              </Text>
            </Box>
            <Box width={26}>
              <Text color={isModified ? 'yellow' : 'white'}>{droid.model}</Text>
            </Box>
            <Box width={10}>
              <Text dimColor>{droid.location}</Text>
            </Box>
            <Box width={10}>
              <Text color="yellow">{isModified ? 'modified' : ''}</Text>
            </Box>
          </Box>
        );
      })}

      {/* Status bar */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text>
          {droids.length} droids
          {modifiedCount > 0 ? ` | ${modifiedCount} modified` : ''}
          {message ? ` | ${message}` : ''}
        </Text>
      </Box>

      {/* Help */}
      <Box marginTop={1}>
        <Text dimColor>
          ↑↓/j/k: Navigate | Enter: Edit | a: Set All | i: All Inherit | s: Save | r: Reload | q: Quit
        </Text>
      </Box>
    </Box>
  );
}
