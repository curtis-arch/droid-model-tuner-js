import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Select, StatusMessage, Badge } from '@inkjs/ui';
import Table from 'ink-table';
import { VERSION, discoverDroids, getAvailableModels, saveDroid } from './models.js';

const STATE_LIST = 'list';
const STATE_PICKER = 'picker';
const STATE_PICKER_ALL = 'picker_all';

export default function App() {
  const { exit } = useApp();
  const [droids, setDroids] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [state, setState] = useState(STATE_LIST);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info');

  useEffect(() => {
    setDroids(discoverDroids());
  }, []);

  const modifiedCount = droids.filter(d => d.model !== d.originalModel).length;

  // Build model picker options
  const { factory, byok } = getAvailableModels();
  const modelOptions = [
    ...factory.map(m => ({ 
      label: m, 
      value: `factory:${m}` 
    })),
    ...byok.map(m => ({ 
      label: `${m} (BYOK)`, 
      value: `byok:${m}` 
    })),
  ];

  const showMessage = (msg, type = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  useInput((input, key) => {
    if (state === STATE_LIST) {
      if (input === 'q') {
        if (modifiedCount > 0 && !message?.includes('force')) {
          showMessage("Unsaved changes! Press 'q' again to force quit", 'warning');
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
        setDroids([...droids]);
        showMessage(saved > 0 ? `Saved ${saved} droid(s)` : 'No changes to save', 'success');
      }
      if (input === 'a') {
        setState(STATE_PICKER_ALL);
      }
      if (input === 'i') {
        const updated = droids.map(d => ({ ...d, model: 'inherit' }));
        setDroids(updated);
        showMessage("All droids set to 'inherit'", 'success');
      }
      if (input === 'r') {
        setDroids(discoverDroids());
        showMessage('Reloaded from disk', 'info');
      }
      if (key.return && droids.length > 0) {
        setState(STATE_PICKER);
      }
      if ((key.downArrow || input === 'j') && selectedIndex < droids.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      }
      if ((key.upArrow || input === 'k') && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
    }
    
    if ((state === STATE_PICKER || state === STATE_PICKER_ALL) && key.escape) {
      setState(STATE_LIST);
    }
  });

  const handleModelSelect = (value) => {
    let model = value;
    if (model.startsWith('factory:') || model.startsWith('byok:')) {
      model = model.split(':')[1];
    }

    if (state === STATE_PICKER) {
      const updated = [...droids];
      updated[selectedIndex] = { ...updated[selectedIndex], model };
      setDroids(updated);
      showMessage(`Set ${droids[selectedIndex].name} to '${model}'`, 'success');
    } else if (state === STATE_PICKER_ALL) {
      const updated = droids.map(d => ({ ...d, model }));
      setDroids(updated);
      showMessage(`All droids set to '${model}'`, 'success');
    }
    setState(STATE_LIST);
  };

  // Model picker screen
  if (state === STATE_PICKER || state === STATE_PICKER_ALL) {
    const title = state === STATE_PICKER 
      ? `Select model for: ${droids[selectedIndex]?.name}` 
      : 'Set ALL droids to:';
    
    const currentModel = state === STATE_PICKER ? droids[selectedIndex]?.model : 'inherit';
    const defaultValue = modelOptions.find(o => o.value.endsWith(`:${currentModel}`))?.value;

    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">{title}</Text>
        </Box>
        <Box borderStyle="round" borderColor="cyan" padding={1}>
          <Select
            options={modelOptions}
            defaultValue={defaultValue}
            onChange={handleModelSelect}
            visibleOptionCount={12}
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>↑↓ Navigate • Enter Select • Esc Cancel</Text>
        </Box>
      </Box>
    );
  }

  // Prepare table data
  const tableData = droids.map((droid, index) => ({
    ' ': index === selectedIndex ? '▶' : ' ',
    Name: droid.name,
    Model: droid.model,
    Location: droid.location,
    Status: droid.model !== droid.originalModel ? '●' : '',
  }));

  // Main list view
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">Droid Model Tuner v{VERSION}</Text>
        <Box gap={1}>
          <Badge color="blue">{droids.length} droids</Badge>
          {modifiedCount > 0 && <Badge color="yellow">{modifiedCount} modified</Badge>}
        </Box>
      </Box>

      {/* Table */}
      {droids.length > 0 ? (
        <Box borderStyle="round" borderColor="gray">
          <Table 
            data={tableData} 
            columns={[' ', 'Name', 'Model', 'Location', 'Status']}
          />
        </Box>
      ) : (
        <Box padding={2}>
          <Text color="yellow">No droids found in ~/.factory/droids/</Text>
        </Box>
      )}

      {/* Status message */}
      {message && (
        <Box marginTop={1}>
          <StatusMessage variant={messageType}>{message}</StatusMessage>
        </Box>
      )}

      {/* Help */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          ↑↓/jk Navigate • Enter Edit • a Set All • i All Inherit • s Save • r Reload • q Quit
        </Text>
      </Box>
    </Box>
  );
}
