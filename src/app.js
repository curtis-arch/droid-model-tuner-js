import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Select, StatusMessage, Badge } from '@inkjs/ui';
import { VERSION, discoverDroids, getAvailableModels, getReasoningLevels, saveDroid } from './models.js';

const STATE_LIST = 'list';
const STATE_PICKER = 'picker';
const STATE_PICKER_ALL = 'picker_all';
const STATE_REASONING = 'reasoning';
const STATE_REASONING_ALL = 'reasoning_all';

// Truncate string with ellipsis
function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 1) + '…';
}

// Custom Table Row component
function TableRow({ columns, widths, isHeader, isSelected }) {
  return (
    <Box>
      {columns.map((col, i) => (
        <Box key={i} width={widths[i]} paddingRight={1}>
          <Text 
            bold={isHeader} 
            color={isHeader ? 'gray' : (isSelected ? 'cyan' : 'white')}
            dimColor={isHeader}
          >
            {col}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

export default function App() {
  const { exit } = useApp();
  const [droids, setDroids] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [state, setState] = useState(STATE_LIST);
  const [pendingModel, setPendingModel] = useState(null);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info');

  useEffect(() => {
    setDroids(discoverDroids());
  }, []);

  const modifiedCount = droids.filter(d => 
    d.model !== d.originalModel || d.reasoningEffort !== d.originalReasoningEffort
  ).length;

  // Build model picker options with section headers
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
          if (droid.model !== droid.originalModel || 
              droid.reasoningEffort !== droid.originalReasoningEffort) {
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
    if ((state === STATE_REASONING || state === STATE_REASONING_ALL) && key.escape) {
      setPendingModel(null);
      setState(STATE_LIST);
    }
  });

  const handleModelSelect = (value) => {
    let model = value;
    if (model.startsWith('factory:') || model.startsWith('byok:')) {
      model = model.split(':')[1];
    }

    const reasoning = getReasoningLevels(model);
    const hasReasoning = reasoning && reasoning.supported.length > 0 && 
      !reasoning.supported.every(l => l === 'none');

    if (hasReasoning) {
      setPendingModel(model);
      setState(state === STATE_PICKER ? STATE_REASONING : STATE_REASONING_ALL);
    } else {
      applyModelChange(model, null);
    }
  };

  const applyModelChange = (model, reasoningEffort) => {
    if (state === STATE_PICKER || state === STATE_REASONING) {
      const updated = [...droids];
      updated[selectedIndex] = { ...updated[selectedIndex], model, reasoningEffort };
      setDroids(updated);
      const effortStr = reasoningEffort ? ` (${reasoningEffort})` : '';
      showMessage(`Set ${droids[selectedIndex].name} to '${model}${effortStr}'`, 'success');
    } else if (state === STATE_PICKER_ALL || state === STATE_REASONING_ALL) {
      const updated = droids.map(d => ({ ...d, model, reasoningEffort }));
      setDroids(updated);
      const effortStr = reasoningEffort ? ` (${reasoningEffort})` : '';
      showMessage(`All droids set to '${model}${effortStr}'`, 'success');
    }
    setPendingModel(null);
    setState(STATE_LIST);
  };

  const handleReasoningSelect = (value) => {
    const effort = value === 'skip' ? null : value;
    applyModelChange(pendingModel, effort);
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
          <Text bold color="cyan">╭─ {title} ─╮</Text>
        </Box>
        <Box borderStyle="round" borderColor="cyan" paddingX={1}>
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

  // Reasoning effort picker screen
  if (state === STATE_REASONING || state === STATE_REASONING_ALL) {
    const reasoning = getReasoningLevels(pendingModel);
    const currentEffort = state === STATE_REASONING 
      ? droids[selectedIndex]?.reasoningEffort 
      : null;
    
    const options = [
      { label: 'Skip (no reasoning effort)', value: 'skip' },
      ...reasoning.supported
        .filter(l => l !== 'none')
        .map(l => ({ 
          label: l === reasoning.default ? `${l} (default)` : l, 
          value: l 
        })),
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">╭─ Reasoning Effort for: {truncate(pendingModel, 30)} ─╮</Text>
        </Box>
        <Box borderStyle="round" borderColor="cyan" paddingX={1}>
          <Select
            options={options}
            defaultValue={currentEffort || 'skip'}
            onChange={handleReasoningSelect}
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>↑↓ Navigate • Enter Select • Esc Cancel</Text>
        </Box>
      </Box>
    );
  }

  // Column widths
  const widths = [3, 32, 26, 10, 8];

  // Main list view
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">╭─ Droid Model Tuner v{VERSION} ─╮</Text>
        <Box gap={1}>
          <Badge color="blue">{droids.length} droids</Badge>
          {modifiedCount > 0 && <Badge color="yellow">{modifiedCount} modified</Badge>}
        </Box>
      </Box>

      {/* Table */}
      {droids.length > 0 ? (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          {/* Table header */}
          <TableRow 
            columns={['', 'Name', 'Model', 'Location', 'Status']} 
            widths={widths}
            isHeader 
          />
          <Box>
            <Text dimColor>{'─'.repeat(76)}</Text>
          </Box>
          {/* Table rows */}
          {droids.map((droid, index) => {
            const isSelected = index === selectedIndex;
            const isModified = droid.model !== droid.originalModel || 
              droid.reasoningEffort !== droid.originalReasoningEffort;
            const modelDisplay = droid.reasoningEffort 
              ? `${droid.model} (${droid.reasoningEffort})` 
              : droid.model;
            return (
              <TableRow
                key={droid.name}
                columns={[
                  isSelected ? '▶' : ' ',
                  truncate(droid.name, 30),
                  truncate(modelDisplay, 24),
                  droid.location,
                  isModified ? '●' : ''
                ]}
                widths={widths}
                isSelected={isSelected}
              />
            );
          })}
        </Box>
      ) : (
        <Box padding={2} borderStyle="round" borderColor="yellow">
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
      <Box marginTop={1}>
        <Text dimColor>
          ↑↓/jk Navigate • Enter Edit • a Set All • i All Inherit • s Save • r Reload • q Quit
        </Text>
      </Box>
    </Box>
  );
}
