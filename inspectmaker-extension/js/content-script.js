/**
 * Content Script - Injetado em todas as páginas web
 * Responsável por executar scripts no contexto da página
 */

// Armazenar scripts ativos para esta página
let activeScripts = [];
let eventListeners = {};

// Escutar mensagens do background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'executeScript') {
    executeScript(message.script)
      .then(result => {
        sendResponse({ success: true, output: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Manter a conexão aberta para resposta assíncrona
  } else if (message.action === 'initializeScripts') {
    initializeScripts();
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'injectScript') {
    // Adicionar script à lista de scripts ativos
    if (!activeScripts.some(s => s.id === message.script.id)) {
      activeScripts.push(message.script);
      processScript(message.script);
      sendResponse({ success: true, message: 'Script adicionado para injeção' });
    } else {
      sendResponse({ success: true, message: 'Script já está na lista de injeção' });
    }
    return true;
  } else if (message.action === 'removeInjection') {
    // Remover script da lista de scripts ativos e limpar recursos
    removeScriptInjection(message.scriptId);
    sendResponse({ success: true, message: 'Injeção do script removida' });
    return true;
  }
});

/**
 * Detecta o navegador atual
 * @returns {string} Nome do navegador ('chrome', 'firefox', 'edge', etc.)
 */
function detectBrowser() {
  if (typeof browser !== 'undefined') {
    // Firefox e outros navegadores baseados em Gecko geralmente definem 'browser'
    return 'firefox';
  } else if (typeof chrome !== 'undefined') {
    if (navigator.userAgent.indexOf("Edg") !== -1) {
      return 'edge';
    } else if (navigator.userAgent.indexOf("Chrome") !== -1) {
      return 'chrome';
    } else if (navigator.userAgent.indexOf("Safari") !== -1) {
      return 'safari';
    }
  }
  return 'unknown';
}

/**
 * Executa um script no contexto da página
 * @param {Object} script O script a ser executado
 * @returns {any} O resultado da execução
 */
function executeScript(script) {
  return new Promise((resolve, reject) => {
    try {
      const browserType = detectBrowser();
      const injectionMethod = script.browserSpecificInjection?.[browserType] || 'standard';
      
      console.log(`Usando método de injeção '${injectionMethod}' para navegador '${browserType}'`);
      
      switch (injectionMethod) {
        case 'browser-api':
          // Usar APIs específicas do navegador para injeção se disponíveis
          if (browserType === 'firefox' && typeof browser !== 'undefined' && browser.tabs && browser.tabs.executeScript) {
            browser.tabs.executeScript({
              code: script.code
            }).then(result => {
              resolve('Script executado com sucesso via API Firefox');
            }).catch(error => {
              reject(new Error(`Erro na API Firefox: ${error.message}`));
            });
            return;
          } else if ((browserType === 'chrome' || browserType === 'edge') && 
                    chrome.scripting && chrome.scripting.executeScript) {
            // Chrome/Edge com Manifest V3
            chrome.scripting.executeScript({
              target: { tabId: chrome.devtools?.inspectedWindow?.tabId || -1 },
              func: new Function(script.code),
            }).then(results => {
              resolve('Script executado com sucesso via API Chrome/Edge');
            }).catch(error => {
              reject(new Error(`Erro na API Chrome/Edge: ${error.message}`));
              // Em caso de falha na API, voltar para o método padrão
              executeStandardInjection(script, resolve, reject);
            });
            return;
          }
          // Se chegarmos aqui, o método de API não funcionou, usar método padrão
          executeStandardInjection(script, resolve, reject);
          break;
          
        case 'eval-injection':
          // Método alternativo para navegadores que têm restrições específicas
          const evalScript = document.createElement('script');
          evalScript.textContent = `
            try {
              const result = (function() { ${script.code} })();
              window.postMessage({
                action: 'inspectmaker-result',
                scriptId: ${script.id},
                success: true,
                result: result
              }, '*');
            } catch (error) {
              window.postMessage({
                action: 'inspectmaker-result',
                scriptId: ${script.id},
                success: false,
                error: error.message
              }, '*');
            }
          `;
          
          const messageListener = (event) => {
            if (event.source !== window || !event.data || 
                event.data.action !== 'inspectmaker-result' ||
                event.data.scriptId !== script.id) {
              return;
            }
            
            window.removeEventListener('message', messageListener);
            
            if (event.data.success) {
              resolve('Script executado com sucesso: ' + (event.data.result || ''));
            } else {
              reject(new Error(event.data.error || 'Erro desconhecido na execução do script'));
            }
          };
          
          window.addEventListener('message', messageListener);
          document.documentElement.appendChild(evalScript);
          setTimeout(() => evalScript.remove(), 100);
          break;
          
        case 'standard':
        default:
          // Método padrão que funciona na maioria dos navegadores
          executeStandardInjection(script, resolve, reject);
          break;
      }
    } catch (error) {
      console.error('Erro ao executar script:', error);
      reject(new Error(`Erro: ${error.message}`));
    }
  });
}

/**
 * Implementa o método padrão de injeção de script com web_accessible_resources
 * @param {Object} script O script a ser executado
 * @param {Function} resolve Função de resolução da promessa
 * @param {Function} reject Função de rejeição da promessa
 */
function executeStandardInjection(script, resolve, reject) {
  // Usar o script inject.js registrado como web_accessible_resource
  const scriptURL = chrome.runtime.getURL('js/inject.js');
  
  // Criar um elemento script que carrega nosso script injetor
  const loaderScript = document.createElement('script');
  loaderScript.src = scriptURL;
  loaderScript.onload = () => {
    // Uma vez que o script injetor é carregado, vamos enviar uma mensagem para ele
    window.postMessage({
      action: 'inspectmaker-execute',
      scriptId: script.id,
      code: script.code
    }, '*');
    
    // Configurar um listener para receber o resultado
    const messageListener = (event) => {
      if (event.source !== window || !event.data || 
          event.data.action !== 'inspectmaker-result' ||
          event.data.scriptId !== script.id) {
        return;
      }
      
      // Remover o listener quando obtivermos o resultado
      window.removeEventListener('message', messageListener);
      
      if (event.data.success) {
        resolve('Script executado com sucesso: ' + (event.data.result || ''));
      } else {
        reject(new Error(event.data.error || 'Erro desconhecido na execução do script'));
      }
    };
    
    window.addEventListener('message', messageListener);
    
    // Remover o script injetor após uso
    loaderScript.remove();
  };
  
  loaderScript.onerror = (error) => {
    reject(new Error('Falha ao carregar o script injetor: ' + error.message));
    loaderScript.remove();
  };
  
  document.documentElement.appendChild(loaderScript);
}

/**
 * Verifica se uma URL corresponde a um padrão com curingas
 * @param {string} url A URL a verificar
 * @param {string[]} patterns Array de padrões de URL a comparar
 * @returns {boolean} true se a URL corresponder a algum padrão, false caso contrário
 */
function urlMatchesPatterns(url, patterns) {
  // Se não houver padrões definidos, considerar que corresponde a todas as URLs
  if (!patterns || patterns.length === 0) {
    return true;
  }
  
  return patterns.some(pattern => {
    // Verificar se o padrão é um objeto (formato avançado) ou uma string
    let patternText = pattern;
    let patternEnabled = true;
    
    // Se for um objeto, extrair o texto e o estado de habilitação
    if (typeof pattern === 'object' && pattern !== null) {
      patternText = pattern.text;
      patternEnabled = pattern.enabled !== false; // Se enabled for undefined/null, considerar como true
    }
    
    // Se o padrão estiver desabilitado, pular
    if (!patternEnabled) {
      return false;
    }
    
    // Converter o padrão para regex
    const regexPattern = patternText
      .replace(/\./g, '\\.')        // Escapar pontos
      .replace(/\*/g, '.*');        // Converter asteriscos em curinga regex
    
    const regex = new RegExp(regexPattern);
    return regex.test(url);
  });
}

/**
 * Inicializa os scripts para a página atual
 */
function initializeScripts() {
  // Obter URL atual
  const currentUrl = window.location.href;
  
  // Solicitar scripts ao background
  chrome.runtime.sendMessage({ action: 'getActiveScripts' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Erro ao obter scripts:', chrome.runtime.lastError);
      return;
    }
    
    if (!response || !response.scripts) {
      return;
    }
    
    // Filtrar scripts por URL
    activeScripts = response.scripts.filter(script => {
      return script.enabled && urlMatchesPatterns(currentUrl, script.urlPatterns);
    });
    
    // Processar cada script de acordo com seu modo de injeção
    activeScripts.forEach(processScript);
  });
}

/**
 * Processa um script de acordo com seu modo de injeção
 * @param {Object} script O script a processar
 */
function processScript(script) {
  switch (script.injectionMode) {
    case 'instantaneous':
      // Executar imediatamente
      executeScript(script);
      break;
      
    case 'delayed':
      // Executar após delay
      setTimeout(() => {
        executeScript(script);
      }, script.delayTime || 1000);
      break;
      
    case 'eventBased':
      // Configurar para executar no evento especificado
      if (script.eventTrigger) {
        const listener = (event) => {
          executeScript(script);
        };
        
        // Armazenar referência do listener para limpeza posterior
        eventListeners[script.id] = {
          event: script.eventTrigger,
          listener: listener
        };
        
        // Se o evento é um evento personalizado (prefixo 'custom:')
        if (script.eventTrigger.startsWith('custom:')) {
          const customEventName = script.eventTrigger.substring(7); // remover 'custom:'
          document.addEventListener(customEventName, listener);
        } else {
          document.addEventListener(script.eventTrigger, listener);
        }
      }
      break;
      
    case 'persistent':
      // Executar em intervalos regulares
      const intervalId = setInterval(() => {
        executeScript(script);
      }, script.persistentInterval || 5000);
      
      // Armazenar ID do intervalo para limpeza posterior
      eventListeners[script.id] = {
        intervalId: intervalId
      };
      break;
      
    case 'urlBased':
      // Executa quando a URL mudar (útil para SPAs)
      const currentUrl = window.location.href;
      let lastUrl = currentUrl;
      
      // Verificar mudanças na URL periodicamente
      const urlCheckIntervalId = setInterval(() => {
        const newUrl = window.location.href;
        if (newUrl !== lastUrl) {
          console.log(`URL mudou: ${lastUrl} -> ${newUrl}`);
          lastUrl = newUrl;
          executeScript(script);
        }
      }, 1000); // Verificar a cada 1 segundo
      
      // Armazenar ID do intervalo para limpeza posterior
      eventListeners[script.id] = {
        intervalId: urlCheckIntervalId
      };
      break;
      
    case 'elementCreated':
      // Executa quando um elemento específico é criado no DOM
      const elementSelector = script.targetSelector || 'div';
      
      // Usar MutationObserver para detectar mudanças no DOM
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
              // Verificar se é um elemento DOM e corresponde ao seletor
              if (node.nodeType === 1 && node.matches && node.matches(elementSelector)) {
                console.log(`Elemento correspondente criado: ${elementSelector}`);
                executeScript(script);
                // Não parar a observação para capturar todos os elementos correspondentes
              } else if (node.nodeType === 1) {
                // Verificar elementos filhos recém-adicionados também
                const matches = node.querySelectorAll(elementSelector);
                if (matches.length > 0) {
                  console.log(`Elemento correspondente encontrado dentro do novo nó: ${elementSelector}`);
                  executeScript(script);
                  // Não parar a observação para capturar todos os elementos correspondentes
                }
              }
            }
          }
        }
      });
      
      // Iniciar a observação
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
      
      // Armazenar referência ao observer para limpeza posterior
      eventListeners[script.id] = {
        observer: observer
      };
      break;
      
    case 'ajaxInterceptor':
      // Intercepta requisições AJAX e executa o script quando completadas
      const originalXHR = window.XMLHttpRequest;
      
      // Criar uma função para envolver o XHR original
      function wrappedXHR() {
        const xhr = new originalXHR();
        
        // Armazenar a URL para referência
        let requestUrl = '';
        let requestMethod = '';
        
        // Interceptar método open para capturar URL
        const originalOpen = xhr.open;
        xhr.open = function(method, url) {
          requestMethod = method;
          requestUrl = url;
          return originalOpen.apply(this, arguments);
        };
        
        // Interceptar quando a requisição for completada
        xhr.addEventListener('load', function() {
          console.log(`Requisição AJAX completada: ${requestMethod} ${requestUrl}`);
          
          // Se há um filtro de URL no script, verificar se corresponde
          if (script.ajaxUrlFilter) {
            if (!requestUrl.includes(script.ajaxUrlFilter)) {
              return; // Não executar se não corresponder ao filtro
            }
          }
          
          // Executar o script com contexto adicional sobre a requisição
          const scriptWithContext = { 
            ...script,
            ajaxContext: {
              url: requestUrl,
              method: requestMethod,
              status: this.status,
              responseText: this.responseText
            }
          };
          
          executeScript(scriptWithContext);
        });
        
        return xhr;
      }
      
      // Substituir o XMLHttpRequest global
      window.XMLHttpRequest = wrappedXHR;
      
      // Armazenar a referência original para restauração posterior
      eventListeners[script.id] = {
        originalXHR: originalXHR,
        cleanup: function() {
          window.XMLHttpRequest = originalXHR;
        }
      };
      break;
      
    case 'historyStateChanged':
      // Executa quando o estado da história do navegador muda (pushState/replaceState)
      // Útil para SPAs que usam History API
      
      // Interceptar window.history.pushState
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;
      
      function historyStateListener() {
        console.log('Estado da história alterado');
        executeScript(script);
      }
      
      // Substituir pushState e replaceState
      window.history.pushState = function() {
        originalPushState.apply(this, arguments);
        historyStateListener();
      };
      
      window.history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        historyStateListener();
      };
      
      // Adicionar listener para eventos de popstate (botões voltar/avançar)
      window.addEventListener('popstate', historyStateListener);
      
      // Armazenar referências originais para restauração posterior
      eventListeners[script.id] = {
        originalPushState,
        originalReplaceState,
        listener: historyStateListener,
        cleanup: function() {
          window.history.pushState = originalPushState;
          window.history.replaceState = originalReplaceState;
          window.removeEventListener('popstate', historyStateListener);
        }
      };
      break;
  }
}

/**
 * Remove a injeção de um script específico
 * @param {number} scriptId ID do script a ser removido
 */
function removeScriptInjection(scriptId) {
  // Remover da lista de scripts ativos
  activeScripts = activeScripts.filter(script => script.id !== scriptId);
  
  // Limpar recursos associados a este script
  if (eventListeners[scriptId]) {
    const item = eventListeners[scriptId];
    
    // Remover listener de evento se existir
    if (item.event && item.listener) {
      // Verificar se é um evento personalizado
      if (item.event.startsWith('custom:')) {
        const customEventName = item.event.substring(7);
        document.removeEventListener(customEventName, item.listener);
      } else {
        document.removeEventListener(item.event, item.listener);
      }
    }
    
    // Limpar intervalo se existir
    if (item.intervalId) {
      clearInterval(item.intervalId);
    }
    
    // Limpar MutationObserver se existir
    if (item.observer && typeof item.observer.disconnect === 'function') {
      item.observer.disconnect();
    }
    
    // Executar função de limpeza personalizada se existir
    if (item.cleanup && typeof item.cleanup === 'function') {
      item.cleanup();
    }
    
    // Restaurar XMLHttpRequest original se existir
    if (item.originalXHR) {
      window.XMLHttpRequest = item.originalXHR;
    }
    
    // Remover do objeto de eventListeners
    delete eventListeners[scriptId];
  }
}

// Limpar recursos ao descarregar a página
window.addEventListener('beforeunload', () => {
  // Limpar todos os listeners de eventos
  Object.values(eventListeners).forEach(item => {
    // Remover listeners de eventos
    if (item.event && item.listener) {
      // Verificar se é um evento personalizado
      if (item.event.startsWith('custom:')) {
        const customEventName = item.event.substring(7);
        document.removeEventListener(customEventName, item.listener);
      } else {
        document.removeEventListener(item.event, item.listener);
      }
    }
    
    // Limpar intervalos
    if (item.intervalId) {
      clearInterval(item.intervalId);
    }
    
    // Limpar MutationObserver
    if (item.observer && typeof item.observer.disconnect === 'function') {
      item.observer.disconnect();
    }
    
    // Executar função de limpeza personalizada
    if (item.cleanup && typeof item.cleanup === 'function') {
      item.cleanup();
    }
    
    // Restaurar XMLHttpRequest original
    if (item.originalXHR) {
      window.XMLHttpRequest = item.originalXHR;
    }
  });
});

// Inicializar scripts ao carregar a página
initializeScripts();