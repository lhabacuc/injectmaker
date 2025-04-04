/**
 * Servidor local para execução de scripts no PC
 * Este servidor permite que a extensão InspectMaker execute código JavaScript no ambiente Node.js
 */
const http = require('http');
const { VM } = require('vm2');

// Configurações do servidor
const PORT = process.argv[2] || 8081;
const HOST = 'localhost';

// Criar servidor HTTP
const server = http.createServer((req, res) => {
  // Configurar CORS para permitir solicitações da extensão
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Lidar com solicitações OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Verificar se é uma solicitação POST para executar código
  if (req.method === 'POST' && req.url === '/execute') {
    let body = '';
    
    // Receber dados do corpo
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    // Processar solicitação quando completa
    req.on('end', () => {
      try {
        // Analisar dados JSON
        const data = JSON.parse(body);
        
        if (!data.code) {
          sendResponse(res, 400, { error: 'Nenhum código fornecido' });
          return;
        }
        
        // Executar código em ambiente seguro
        const result = executeCode(data.code);
        sendResponse(res, 200, { result });
      } catch (error) {
        console.error('Erro ao processar solicitação:', error);
        sendResponse(res, 500, { error: error.message });
      }
    });
  } else if (req.method === 'GET' && req.url === '/status') {
    // Endpoint de status para verificar se o servidor está em execução
    sendResponse(res, 200, { status: 'running', version: '1.0.0' });
  } else {
    // Manipular outras solicitações
    sendResponse(res, 404, { error: 'Endpoint não encontrado' });
  }
});

// Iniciar servidor
server.listen(PORT, HOST, () => {
  console.log(`Servidor InspectMaker em execução em http://${HOST}:${PORT}`);
  console.log('Pressione Ctrl+C para encerrar');
});

/**
 * Função utilitária para enviar respostas JSON
 * @param {http.ServerResponse} res Objeto de resposta HTTP
 * @param {number} statusCode Código de status HTTP
 * @param {Object} data Dados a serem enviados como JSON
 */
function sendResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Executa código JavaScript em um ambiente Node.js controlado
 * @param {string} code Código JavaScript a ser executado
 * @returns {any} Resultado da execução
 */
function executeCode(code) {
  try {
    // Criar sandbox seguro para execução
    const vm = new VM({
      timeout: 5000, // 5 segundos de limite de execução
      sandbox: {
        console: {
          log: (...args) => console.log('[Script]', ...args),
          error: (...args) => console.error('[Script]', ...args),
          warn: (...args) => console.warn('[Script]', ...args),
          info: (...args) => console.info('[Script]', ...args)
        },
        // Adicionar módulos e APIs permitidos
        require: require,
        Buffer: Buffer,
        process: {
          env: process.env
        }
      }
    });
    
    // Executar código na sandbox
    const result = vm.run(code);
    return result === undefined ? 'Script executado com sucesso (sem retorno)' : result;
  } catch (error) {
    console.error('Erro ao executar script:', error);
    throw new Error(`Falha ao executar script: ${error.message}`);
  }
}

// Manipular evento de encerramento
process.on('SIGINT', () => {
  console.log('\nEncerrando servidor InspectMaker...');
  server.close(() => {
    console.log('Servidor encerrado');
    process.exit(0);
  });
});