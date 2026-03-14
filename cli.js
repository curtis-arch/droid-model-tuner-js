#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import App from './app.js';
import { syncModelsFromProxy } from './models.js';

await syncModelsFromProxy();
render(React.createElement(App));
