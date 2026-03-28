import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { SlideModel, ResolvedConfig } from '../model/types.js';
import { renderPresentation } from '../renderer/html.js';

let currentModel: SlideModel | null = null;
let currentConfig: ResolvedConfig | null = null;
let currentPort = 3000;
let currentWorkDir: string | undefined;

const clients = new Set<WebSocket>();

export function broadcast(message: object): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function updateServerModel(model: SlideModel): void {
  currentModel = model;
}

export function createServer(
  model: SlideModel,
  config: ResolvedConfig,
  port: number,
  workDir?: string
): http.Server {
  currentModel = model;
  currentConfig = config;
  currentPort = port;
  currentWorkDir = workDir;

  const server = http.createServer(async (req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      try {
        const html = await renderPresentation(
          currentModel!,
          currentConfig!,
          { hotReload: true, port: currentPort, workDir: currentWorkDir }
        );
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (err) {
        res.writeHead(500);
        res.end('Error rendering presentation');
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  return server;
}
