/**
 * Background Script
 * Executa em segundo plano e gerencia a execução de scripts
 */

// Configurações padrão para o popup
const DEFAULT_POPUP_SIZE = {
  mobile: { width: 360, height: 600 },
  tablet: { width: 600, height: 700 },
  desktop: { width: 800, height: 700 }
};

// Obter as configurações de tamanho do popup
function getPopupSize() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get('popupSize', data => {
        if (chrome.runtime.lastError) {
          console.error('Erro ao recuperar tamanho do popup:', chrome.runtime.lastError);
          resolve(DEFAULT_POPUP_SIZE);
          return;
        }
        
        // Se não houver configurações de tamanho salvas ou estiverem incompletas, usar os padrões
        let popupSize = data.popupSize || {};
        
        // Garantir que todos os tipos de dispositivo têm tamanhos definidos
        if (!popupSize.desktop || !popupSize.desktop.width || !popupSize.desktop.height) {
          popupSize.desktop = DEFAULT_POPUP_SIZE.desktop;
        }
        
        if (!popupSize.tablet || !popupSize.tablet.width || !popupSize.tablet.height) {
          popupSize.tablet = DEFAULT_POPUP_SIZE.tablet;
        }
        
        if (!popupSize.mobile || !popupSize.mobile.width || !popupSize.mobile.height) {
          popupSize.mobile = DEFAULT_POPUP_SIZE.mobile;
        }
        
        resolve(popupSize);
      });
    } catch (error) {
      console.error('Erro ao obter tamanho do popup:', error);
      resolve(DEFAULT_POPUP_SIZE);
    }
  });
}

// Salvar as configurações de tamanho do popup
function savePopupSize(deviceType, width, height) {
  return new Promise((resolve) => {
    try {
      // Validar parâmetros para evitar valores inválidos
      if (!deviceType || !width || !height || 
          !['desktop', 'tablet', 'mobile'].includes(deviceType) ||
          width < 200 || height < 200) {
        console.error(`Valores inválidos para savePopupSize: ${deviceType}, ${width}x${height}`);
        // Usar valores padrão para o dispositivo
        deviceType = deviceType || 'desktop';
        const defaultSize = DEFAULT_POPUP_SIZE[deviceType] || DEFAULT_POPUP_SIZE.desktop;
        width = width || defaultSize.width;
        height = height || defaultSize.height;
      }
      
      chrome.storage.local.get('popupSize', data => {
        if (chrome.runtime.lastError) {
          console.error('Erro ao recuperar tamanho do popup:', chrome.runtime.lastError);
          resolve(DEFAULT_POPUP_SIZE);
          return;
        }
        
        // Obter configurações atuais ou usar os padrões
        const popupSize = data.popupSize || DEFAULT_POPUP_SIZE;
        
        // Atualizar o tamanho para o tipo de dispositivo
        popupSize[deviceType] = { 
          width: parseInt(width), 
          height: parseInt(height) 
        };
        
        // Salvar as novas configurações
        chrome.storage.local.set({ popupSize }, () => {
          if (chrome.runtime.lastError) {
            console.error('Erro ao salvar tamanho do popup:', chrome.runtime.lastError);
            resolve(DEFAULT_POPUP_SIZE);
          } else {
            console.log(`Tamanho do popup salvo para ${deviceType}: ${width}x${height}`);
            resolve(popupSize);
          }
        });
      });
    } catch (error) {
      console.error('Erro ao salvar tamanho do popup:', error);
      resolve(DEFAULT_POPUP_SIZE);
    }
  });
}

// Escutar eventos de instalação/atualização
chrome.runtime.onInstalled.addListener(details => {
  console.log('InspectMaker instalado/atualizado:', details.reason);
});

// Detecta o tipo de dispositivo
function detectDeviceType() {
  return new Promise((resolve) => {
    // Primeiro método: usando chrome.system.display API
    if (chrome.system && chrome.system.display) {
      try {
        chrome.system.display.getInfo((displays) => {
          // Verifica se temos informações sobre as telas
          if (displays && displays.length > 0) {
            const width = displays[0].bounds.width;
            const height = displays[0].bounds.height;
            
            console.log(`Tamanho da tela: ${width}x${height}`);
            
            if (width <= 768) {
              resolve('mobile');
            } else if (width <= 1024) {
              resolve('tablet');
            } else {
              resolve('desktop');
            }
            return;
          }
          
          // Se não tem displays, tenta o método alternativo
          useAlternativeMethod();
        });
      } catch (error) {
        console.error('Erro ao usar chrome.system.display:', error);
        useAlternativeMethod();
      }
    } else {
      // API não disponível, usar método alternativo
      useAlternativeMethod();
    }
    
    // Método alternativo: usar detecção baseada em user-agent
    function useAlternativeMethod() {
      console.log('Usando método alternativo de detecção de dispositivo');
      
      try {
        // Obter o user agent do navegador
        const userAgent = getBrowserUserAgent();
        let deviceType = 'desktop';
        
        // Detecção simples baseada no user-agent
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
          if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) {
            deviceType = 'tablet';
          } else {
            deviceType = 'mobile';
          }
        }
        
        console.log(`Tipo de dispositivo detectado (via user-agent): ${deviceType}`);
        resolve(deviceType);
      } catch (error) {
        console.error('Erro ao detectar dispositivo via user-agent:', error);
        // Último recurso: assumir desktop
        resolve('desktop');
      }
    }
  });
}

// Função de utilidade para obter o userAgent do navegador
function getBrowserUserAgent() {
  return navigator.userAgent || '';
}

// Escutar eventos de navegação
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Inicializar scripts quando a página for carregada
    initializeTabScripts(tabId);
  }
});

// Interceptar quando o popup for aberto para ajustar o tamanho
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Detectar o tipo de dispositivo
    const deviceType = await detectDeviceType();
    
    // Obter as configurações de tamanho do popup
    const popupSize = await getPopupSize();
    
    // Obter as dimensões corretas para o tipo de dispositivo
    const size = popupSize[deviceType] || DEFAULT_POPUP_SIZE[deviceType];
    
    console.log(`Dispositivo detectado: ${deviceType}. Abrindo popup com tamanho: ${size.width}x${size.height}`);
    
    // Abrir o popup com o tamanho adequado
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: size.width,
      height: size.height,
      focused: true
    }, (popupWindow) => {
      // Armazenar informações para poder atualizar o tamanho quando a janela for fechada
      if (popupWindow) {
        // Salvar o ID da janela e o tipo de dispositivo para uso posterior
        chrome.storage.local.set({
          currentPopup: {
            windowId: popupWindow.id,
            deviceType: deviceType
          }
        });
      }
    });
  } catch (error) {
    console.error('Erro ao abrir popup:', error);
    // Fallback para comportamento padrão em caso de erro
    chrome.action.setPopup({ popup: 'popup.html' });
  }
});

// Monitorar quando o popup é fechado para salvar o novo tamanho
chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    // Verificar se esta é a janela do popup
    chrome.storage.local.get('currentPopup', async (data) => {
      if (chrome.runtime.lastError) {
        console.error('Erro ao verificar popup:', chrome.runtime.lastError);
        return;
      }
      
      const currentPopup = data.currentPopup;
      
      if (currentPopup && windowId === currentPopup.windowId) {
        console.log('Popup fechado, salvando novas dimensões...');
        
        try {
          // Limpar as informações da janela atual
          chrome.storage.local.remove('currentPopup', () => {
            if (chrome.runtime.lastError) {
              console.error('Erro ao limpar informações do popup:', chrome.runtime.lastError);
            } else {
              console.log('Informações do popup removidas com sucesso');
            }
          });
        } catch (error) {
          console.error('Erro ao processar fechamento de popup:', error);
        }
      }
    });
  } catch (error) {
    console.error('Erro ao monitorar fechamento de janelas:', error);
  }
});

// Manipulador de mensagens da extensão
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (!message || !message.action) {
      console.error('Mensagem inválida recebida:', message);
      sendResponse({ success: false, error: 'Mensagem inválida ou sem ação' });
      return true;
    }
    
    console.log(`Mensagem recebida: ${message.action}`);
    
    switch (message.action) {
      case 'executeScript':
        // Executar script em uma aba específica ou na aba ativa
        if (!message.script) {
          sendResponse({ success: false, error: 'Script não fornecido' });
          return true;
        }
        
        executeScript(message.script, null)
          .then(result => sendResponse(result))
          .catch(error => {
            console.error('Erro ao executar script:', error);
            sendResponse({ 
              success: false, 
              error: error.message || 'Erro desconhecido ao executar script' 
            });
          });
        return true; // Manter a conexão aberta para resposta assíncrona
        
      case 'getActiveScripts':
        // Retornar scripts ativos para a aba especificada
        getActiveScripts(sender.tab?.id || null)
          .then(scripts => sendResponse({ success: true, scripts }))
          .catch(error => {
            console.error('Erro ao obter scripts ativos:', error);
            sendResponse({ 
              success: false, 
              error: error.message || 'Erro desconhecido ao obter scripts ativos'
            });
          });
        return true;
        
      case 'injectScript':
        // Injetar um script em todas as abas compatíveis
        if (!message.script) {
          sendResponse({ success: false, error: 'Script não fornecido para injeção' });
          return true;
        }
        
        injectScript(message.script)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => {
            console.error('Erro ao injetar script:', error);
            sendResponse({ 
              success: false, 
              error: error.message || 'Erro desconhecido ao injetar script' 
            });
          });
        return true;
        
      case 'removeInjection':
        // Remover injeção de um script de todas as abas
        if (!message.scriptId && message.scriptId !== 0) {
          sendResponse({ success: false, error: 'ID do script não fornecido' });
          return true;
        }
        
        removeInjection(message.scriptId)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => {
            console.error('Erro ao remover injeção:', error);
            sendResponse({ 
              success: false, 
              error: error.message || 'Erro desconhecido ao remover injeção' 
            });
          });
        return true;
        
      case 'updatePopupSize':
        // Atualizar tamanho do popup para o tipo de dispositivo especificado
        if (!message.deviceType || !message.width || !message.height) {
          sendResponse({ success: false, error: 'Parâmetros incompletos para atualização de tamanho' });
          return true;
        }
        
        savePopupSize(message.deviceType, message.width, message.height)
          .then(popupSize => sendResponse({ success: true, popupSize }))
          .catch(error => {
            console.error('Erro ao salvar tamanho do popup:', error);
            sendResponse({ 
              success: false, 
              error: error.message || 'Erro desconhecido ao salvar tamanho do popup' 
            });
          });
        return true;
        
      default:
        console.warn(`Ação desconhecida recebida: ${message.action}`);
        sendResponse({ success: false, error: `Ação desconhecida: ${message.action}` });
        return true;
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    sendResponse({ 
      success: false, 
      error: error.message || 'Erro interno ao processar mensagem' 
    });
    return true;
  }
});

/**
 * Inicializa os scripts para uma aba específica
 * @param {number} tabId ID da aba
 */
function initializeTabScripts(tabId) {
  // Enviar mensagem para o content script inicializar
  chrome.tabs.sendMessage(
    tabId,
    { action: 'initializeScripts' },
    response => {
      // Tratamento de erro silencioso, pois o content script pode não estar carregado ainda
      if (chrome.runtime.lastError) {
        console.log(`Tab ${tabId} not ready yet`);
      }
    }
  );
}

/**
 * Executa um script em uma aba específica
 * @param {Object} script O script a ser executado
 * @param {number|null} tabId ID da aba (null para a aba ativa)
 * @returns {Promise<Object>} Resultado da execução
 */
function executeScript(script, tabId) {
  return new Promise((resolve, reject) => {
    if (tabId === null) {
      // Obter a aba ativa
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
          reject(new Error('Nenhuma aba ativa encontrada'));
          return;
        }
        executeScriptInTab(script, tabs[0].id)
          .then(resolve)
          .catch(reject);
      });
    } else {
      // Executar na aba especificada
      executeScriptInTab(script, tabId)
        .then(resolve)
        .catch(reject);
    }
  });
}

/**
 * Executa um script em uma aba específica
 * @param {Object} script O script a ser executado
 * @param {number} tabId ID da aba
 * @returns {Promise<Object>} Resultado da execução
 */
function executeScriptInTab(script, tabId) {
  return new Promise((resolve, reject) => {
    // Verificar o ambiente de execução
    if (script.executionEnvironment === 'pc') {
      // Executar no Node.js local
      executeNodeScript(script)
        .then(resolve)
        .catch(reject);
      return;
    }
    
    // Executar no navegador (ambiente padrão)
    chrome.tabs.sendMessage(
      tabId,
      { action: 'executeScript', script },
      response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error('Falha ao executar script na aba'));
        }
      }
    );
  });
}

/**
 * Obtém os scripts ativos em uma aba específica
 * @param {number|null} tabId ID da aba (null para a aba ativa)
 * @returns {Promise<Array>} Lista de scripts ativos
 */
function getActiveScripts(tabId) {
  return new Promise((resolve, reject) => {
    if (tabId === null) {
      // Obter a aba ativa
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
          reject(new Error('Nenhuma aba ativa encontrada'));
          return;
        }
        getActiveScriptsFromTab(tabs[0].id)
          .then(resolve)
          .catch(reject);
      });
    } else {
      // Obter scripts da aba especificada
      getActiveScriptsFromTab(tabId)
        .then(resolve)
        .catch(reject);
    }
  });
}

/**
 * Obtém os scripts ativos em uma aba específica
 * @param {number} tabId ID da aba
 * @returns {Promise<Array>} Lista de scripts ativos
 */
function getActiveScriptsFromTab(tabId) {
  return new Promise((resolve, reject) => {
    // Obter todos os scripts armazenados
    chrome.storage.local.get('scripts', data => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      const scripts = data.scripts || [];
      // Filtrar por scripts ativos
      const activeScripts = scripts.filter(script => script.enabled);
      resolve(activeScripts);
    });
  });
}

/**
 * Injetar um script em todas as abas compatíveis
 * @param {Object} script O script a ser injetado
 * @returns {Promise<Object>} Resultado da injeção
 */
function injectScript(script) {
  return new Promise((resolve, reject) => {
    // Verificar se o script está ativado
    if (!script.enabled) {
      reject(new Error('O script não está ativado. Ative-o nas configurações.'));
      return;
    }
    
    // Obter todas as abas abertas
    chrome.tabs.query({}, (tabs) => {
      if (tabs.length === 0) {
        reject(new Error('Nenhuma aba encontrada'));
        return;
      }
      
      // Contador para acompanhar o progresso
      let successCount = 0;
      let failCount = 0;
      const totalTabs = tabs.length;
      
      // Para cada aba, tenta injetar o script
      tabs.forEach(tab => {
        // Verificar se o script já está marcado para injeção nesta aba
        chrome.tabs.sendMessage(
          tab.id,
          { action: 'injectScript', script },
          response => {
            // Ignorar erros de comunicação (provavelmente o content script não está carregado)
            if (chrome.runtime.lastError) {
              failCount++;
            } else {
              successCount++;
            }
            
            // Se todas as abas foram processadas, resolver a promessa
            if (successCount + failCount === totalTabs) {
              resolve({
                message: `Script preparado para injeção em ${successCount} abas.`,
                successCount,
                failCount
              });
            }
          }
        );
      });
    });
  });
}

/**
 * Remove a injeção de um script de todas as abas
 * @param {number} scriptId ID do script cuja injeção será removida
 * @returns {Promise<Object>} Resultado da remoção
 */
function removeInjection(scriptId) {
  return new Promise((resolve, reject) => {
    // Obter todas as abas abertas
    chrome.tabs.query({}, (tabs) => {
      if (tabs.length === 0) {
        reject(new Error('Nenhuma aba encontrada'));
        return;
      }
      
      // Contador para acompanhar o progresso
      let successCount = 0;
      let failCount = 0;
      const totalTabs = tabs.length;
      
      // Para cada aba, tenta remover o script
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(
          tab.id,
          { action: 'removeInjection', scriptId },
          response => {
            // Ignorar erros de comunicação (provavelmente o content script não está carregado)
            if (chrome.runtime.lastError) {
              failCount++;
            } else {
              successCount++;
            }
            
            // Se todas as abas foram processadas, resolver a promessa
            if (successCount + failCount === totalTabs) {
              resolve({
                message: `Injeção do script removida de ${successCount} abas.`,
                successCount,
                failCount
              });
            }
          }
        );
      });
    });
  });
}

/**
 * Executa um script Node.js via servidor local
 * @param {Object} script O script a ser executado
 * @returns {Promise<Object>} Resultado da execução
 */
function executeNodeScript(script) {
  return new Promise((resolve, reject) => {
    // Obter configurações do servidor local
    chrome.storage.local.get('settings', data => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      const settings = data.settings || {};
      if (!settings.useLocalHelper) {
        reject(new Error('Servidor local não está ativado nas configurações'));
        return;
      }
      
      const serverPort = settings.localServerPort || 8081;
      const serverUrl = `http://localhost:${serverPort}/execute`;
      
      // Enviar solicitação para o servidor local
      fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: script.code
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Servidor retornou erro: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        resolve({
          success: true,
          output: data.result || 'Script executado com sucesso no Node.js'
        });
      })
      .catch(error => {
        reject(new Error(`Erro ao executar no servidor Node.js: ${error.message}`));
      });
    });
  });
}