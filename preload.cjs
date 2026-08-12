const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('pipeflowDesktop', Object.freeze({
  platform: process.platform,
  version: process.versions.electron,
  isDesktop: true,
}));
