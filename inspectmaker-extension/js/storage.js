/**
 * Módulo de armazenamento
 * Gerencia a persistência de scripts e configurações
 */
const StorageModule = (function() {
  // Configurações padrão
  const DEFAULT_SETTINGS = {
    id: 1,
    defaultExecutionEnvironment: 'browser',
    useLocalHelper: false,
    localServerPort: 8081,
    elevatedPermissions: false,
    domainWhitelist: [],
    editorTheme: 'monokai',
    fontSize: '14px',
    tabSize: 2,
    darkMode: false,
    fullscreenEditor: false,
    
    // Novas opções de segurança
    safeMode: true,
    sandboxScripts: true,
    
    // Configurações avançadas
    scriptExecutionTimeout: 5000,
    autoSaveScripts: false,
    enableScriptLogs: true,
    browserSpecificInjection: true,
    
    // Configuração da chave de licença
    licenseKey: '',
    licenseStatus: 'not_verified'
  };

  /**
   * Recupera scripts do armazenamento (ou usa os padrões)
   * @returns {Promise<Array>} Lista de scripts
   */
  async function getScripts() {
    return new Promise((resolve) => {
      chrome.storage.local.get('scripts', (result) => {
        if (result.scripts && Array.isArray(result.scripts)) {
          resolve(result.scripts);
        } else {
          resolve([]);
        }
      });
    });
  }

  /**
   * Recupera um script específico por ID
   * @param {number} id ID do script
   * @returns {Promise<Object|undefined>} O script, se encontrado
   */
  async function getScriptById(id) {
    const scripts = await getScripts();
    return scripts.find(script => script.id === id);
  }

  /**
   * Salva um script (cria ou atualiza)
   * @param {Object} script O script a ser salvo
   * @returns {Promise<Object>} O script salvo
   */
  async function saveScript(script) {
    const scripts = await getScripts();
    const now = new Date().toISOString();
    
    // Se o script já existir, atualize-o
    if (script.id) {
      const index = scripts.findIndex(s => s.id === script.id);
      if (index !== -1) {
        scripts[index] = { ...scripts[index], ...script, lastEdited: now };
        await saveScriptsToStorage(scripts);
        return scripts[index];
      }
    }
    
    // Caso contrário, crie um novo script
    const newScript = {
      id: Date.now(), // Use timestamp como ID único
      name: script.name || 'Novo Script',
      code: script.code || '// Seu código JavaScript aqui\nconsole.log("Olá do InspectMaker!");',
      enabled: script.enabled !== undefined ? script.enabled : true,
      injectionMode: script.injectionMode || 'instantaneous',
      executionEnvironment: script.executionEnvironment || DEFAULT_SETTINGS.defaultExecutionEnvironment,
      urlPatterns: script.urlPatterns || [],
      lastEdited: now
    };
    
    // Adicione propriedades condicionais com base no modo de injeção
    if (newScript.injectionMode === 'delayed') {
      newScript.delayTime = script.delayTime || 1000;
    } else if (newScript.injectionMode === 'eventBased') {
      newScript.eventTrigger = script.eventTrigger || 'click';
    } else if (newScript.injectionMode === 'persistent') {
      newScript.persistentInterval = script.persistentInterval || 5000;
    }
    
    scripts.push(newScript);
    await saveScriptsToStorage(scripts);
    return newScript;
  }

  /**
   * Exclui um script
   * @param {number} id ID do script a excluir
   * @returns {Promise<boolean>} true se excluído, false se não encontrado
   */
  async function deleteScript(id) {
    const scripts = await getScripts();
    const initialLength = scripts.length;
    const filteredScripts = scripts.filter(script => script.id !== id);
    
    if (filteredScripts.length === initialLength) {
      return false; // Nenhum script foi removido
    }
    
    await saveScriptsToStorage(filteredScripts);
    return true;
  }

  /**
   * Recupera configurações do armazenamento
   * @returns {Promise<Object>} As configurações
   */
  async function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('settings', (result) => {
        if (result.settings) {
          resolve(result.settings);
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      });
    });
  }

  /**
   * Salva configurações
   * @param {Object} settings As configurações a salvar
   * @returns {Promise<Object>} As configurações atualizadas
   */
  async function saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.get('settings', (result) => {
        const currentSettings = result.settings || DEFAULT_SETTINGS;
        const updatedSettings = { ...currentSettings, ...settings };
        
        chrome.storage.local.set({ settings: updatedSettings }, () => {
          resolve(updatedSettings);
        });
      });
    });
  }

  /**
   * Redefine configurações para os padrões
   * @returns {Promise<Object>} As configurações padrão
   */
  async function resetSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS }, () => {
        resolve(DEFAULT_SETTINGS);
      });
    });
  }

  /**
   * Função auxiliar para salvar scripts no armazenamento
   * @param {Array} scripts Lista de scripts
   * @returns {Promise<void>}
   */
  async function saveScriptsToStorage(scripts) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ scripts }, resolve);
    });
  }

  /**
   * Verifica se a chave de licença é válida em um servidor remoto
   * @param {string} key Chave de licença a ser verificada
   * @returns {Promise<boolean>} true se a chave for válida, false caso contrário
   */
  async function verifyLicenseKey(key) {
    try {
      // URL da chave remota
      const keyUrl = 'https://gist.githubusercontent.com/lhabacuc/d31bda81810465321d708e6cf142bd81/raw/dc2e90c3fe5ce8f390ff40dc75061eaf4447ad53/key.txt';
      
      // Buscar a chave remota
      const response = await fetch(keyUrl);
      if (!response.ok) {
        console.error('Erro ao buscar chave remota:', response.statusText);
        return false;
      }
      
      // Obter o conteúdo da chave remota
      const remoteKey = await response.text();
      
      // Remover espaços em branco, tabs e quebras de linha
      const cleanRemoteKey = remoteKey.trim();
      const cleanLocalKey = key.trim();
      
      // Verificar se as chaves correspondem
      return cleanRemoteKey === cleanLocalKey;
    } catch (error) {
      console.error('Erro ao verificar chave de licença:', error);
      return false;
    }
  }
  
  /**
   * Salva uma chave de licença nas configurações
   * @param {string} key Chave de licença a ser salva
   * @returns {Promise<Object>} As configurações atualizadas
   */
  async function saveLicenseKey(key) {
    // Verificar se a chave é válida
    const isValid = await verifyLicenseKey(key);
    
    // Obter configurações atuais
    const settings = await getSettings();
    
    // Atualizar configurações com a nova chave
    settings.licenseKey = key;
    settings.licenseStatus = isValid ? 'valid' : 'invalid';
    
    // Salvar configurações atualizadas
    return saveSettings(settings);
  }
  
  /**
   * Inicia o verificador de licença que executa a cada minuto
   */
  function startLicenseVerifier() {
    // Verificar a licença imediatamente
    checkLicense();
    
    // Configurar verificação a cada minuto
    setInterval(checkLicense, 60000); // 60000 ms = 1 minuto
  }
  
  /**
   * Verifica se a licença ainda é válida
   */
  async function checkLicense() {
    try {
      // Obter configurações
      const settings = await getSettings();
      
      // Se não há chave de licença, retornar
      if (!settings.licenseKey) {
        return;
      }
      
      // Verificar se a chave remota corresponde à chave local
      const isValid = await verifyLicenseKey(settings.licenseKey);
      
      // Atualizar o status da licença
      if (settings.licenseStatus !== (isValid ? 'valid' : 'invalid')) {
        settings.licenseStatus = isValid ? 'valid' : 'invalid';
        await saveSettings(settings);
      }
      
      // Se a chave não for válida, bloquear a extensão
      if (!isValid) {
        blockExtension();
        // Destaque visual no campo de licença
        highlightLicenseField();
      }
    } catch (error) {
      console.error('Erro ao verificar licença:', error);
    }
  }
  
  /**
   * Bloqueia o uso da extensão
   */
  function blockExtension() {
    // Desativar todos os scripts
    chrome.storage.local.get('scripts', (result) => {
      if (result.scripts && Array.isArray(result.scripts)) {
        const disabledScripts = result.scripts.map(script => ({
          ...script,
          enabled: false
        }));
        
        chrome.storage.local.set({ scripts: disabledScripts }, () => {
          console.log('Todos os scripts foram desativados devido a licença inválida');
        });
      }
    });
    
    // Exibir mensagem de licença inválida
    const container = document.querySelector('.container');
    if (container) {
      // Criar elemento de bloqueio
      const blockElement = document.createElement('div');
      blockElement.id = 'license-block';
      blockElement.style.position = 'fixed';
      blockElement.style.top = '0';
      blockElement.style.left = '0';
      blockElement.style.width = '100%';
      blockElement.style.height = '100%';
      blockElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      blockElement.style.zIndex = '9999';
      blockElement.style.display = 'flex';
      blockElement.style.flexDirection = 'column';
      blockElement.style.justifyContent = 'center';
      blockElement.style.alignItems = 'center';
      blockElement.style.color = 'white';
      blockElement.style.padding = '20px';
      blockElement.style.textAlign = 'center';
      
      // Adicionar conteúdo
      blockElement.innerHTML = `
        <h2 style="color: #ff4d4d; margin-bottom: 20px;">Licença Inválida</h2>
        <p style="font-size: 16px; margin-bottom: 15px;">A licença desta extensão não é válida ou expirou.</p>
        <p style="font-size: 14px; margin-bottom: 15px;">Entre em contato com o suporte para obter uma nova chave de licença.</p>
        <div style="margin-top: 20px;">
          <input type="text" id="new-license-key" placeholder="Digite sua chave de licença" 
                style="padding: 8px; width: 300px; margin-bottom: 10px; border-radius: 4px; border: none;">
          <button id="activate-license" 
                  style="padding: 8px 16px; background-color: #4d79ff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Ativar Licença
          </button>
        </div>
      `;
      
      // Adicionar ao corpo do documento
      document.body.appendChild(blockElement);
      
      // Adicionar listener para o botão de ativação
      const activateButton = document.getElementById('activate-license');
      if (activateButton) {
        activateButton.addEventListener('click', async () => {
          const keyInput = document.getElementById('new-license-key');
          if (keyInput && keyInput.value) {
            const isValid = await verifyLicenseKey(keyInput.value);
            if (isValid) {
              await saveLicenseKey(keyInput.value);
              document.getElementById('license-block')?.remove();
              location.reload(); // Recarregar para aplicar as mudanças
            } else {
              alert('A chave de licença fornecida é inválida.');
            }
          }
        });
      }
    }
  }
  
  // Iniciar verificador de licença
  startLicenseVerifier();

  /**
   * Destaca visualmente o campo de licença para chamar atenção do usuário
   */
  function highlightLicenseField() {
    // Envia mensagem para o popup para destacar o campo de licença
    chrome.runtime.sendMessage({
      action: 'highlightLicenseField',
    }).catch(err => {
      // O popup pode não estar aberto, isso é esperado
      console.log('Popup não está aberto para destacar campo de licença');
    });
    
    // Também tenta encontrar e destacar o campo de licença diretamente
    // (se esta função for executada no contexto do popup)
    try {
      const licenseSection = document.querySelector('.license-section');
      if (licenseSection) {
        licenseSection.classList.add('license-highlight');
        
        // Remover destaque após 10 segundos
        setTimeout(() => {
          licenseSection.classList.remove('license-highlight');
        }, 10000);
      }
    } catch (e) {
      // Ignorar erros, pois isso só funciona se esta função for chamada no contexto do popup
    }
  }
  
  // API pública do módulo
  /**
   * Exporta todos os scripts como um arquivo JSON para backup
   * @returns {Promise<Object>} Objeto contendo os scripts e configurações
   */
  async function exportScripts() {
    try {
      const scripts = await getScripts();
      const settings = await getSettings();
      
      // Criar objeto de backup com metadados
      const backup = {
        type: 'inspectmaker-backup',
        version: '1.0',
        createdAt: new Date().toISOString(),
        scripts: scripts,
        settings: settings
      };
      
      return backup;
    } catch (error) {
      console.error('Erro ao exportar scripts:', error);
      throw error;
    }
  }
  
  /**
   * Importa scripts de um backup
   * @param {Object} backupData Dados do backup
   * @param {Object} options Opções de importação
   * @returns {Promise<Object>} Resultado da importação
   */
  async function importScripts(backupData, options = { 
    importSettings: false, 
    replaceExisting: false,
    mergeScripts: true 
  }) {
    try {
      // Validar o backup
      if (!backupData || !backupData.type || backupData.type !== 'inspectmaker-backup') {
        throw new Error('Formato de backup inválido');
      }
      
      let result = {
        success: true,
        scriptsImported: 0,
        settingsImported: false,
        errors: []
      };
      
      // Importar scripts
      if (backupData.scripts && Array.isArray(backupData.scripts)) {
        let currentScripts = [];
        
        // Se não estiver substituindo todos, obter os scripts atuais
        if (!options.replaceExisting) {
          currentScripts = await getScripts();
        }
        
        if (options.replaceExisting) {
          // Substituir todos os scripts
          for (const script of backupData.scripts) {
            // Remover ID para gerar um novo
            const scriptCopy = { ...script };
            delete scriptCopy.id;
            await saveScript(scriptCopy);
            result.scriptsImported++;
          }
        } else if (options.mergeScripts) {
          // Mesclar scripts, adicionando novos e atualizando existentes por nome
          const scriptMap = new Map();
          
          // Mapear scripts existentes por nome
          currentScripts.forEach(script => {
            scriptMap.set(script.name, script);
          });
          
          // Adicionar ou atualizar scripts do backup
          for (const script of backupData.scripts) {
            const existingScript = scriptMap.get(script.name);
            
            if (existingScript) {
              // Atualizar script existente, mantendo o ID original
              const updatedScript = {
                ...script,
                id: existingScript.id
              };
              await saveScript(updatedScript);
            } else {
              // Adicionar novo script
              const scriptCopy = { ...script };
              delete scriptCopy.id; // Remover ID para gerar um novo
              await saveScript(scriptCopy);
            }
            
            result.scriptsImported++;
          }
        } else {
          // Adicionar apenas scripts novos que não existem
          const existingNames = new Set(currentScripts.map(script => script.name));
          
          for (const script of backupData.scripts) {
            if (!existingNames.has(script.name)) {
              const scriptCopy = { ...script };
              delete scriptCopy.id; // Remover ID para gerar um novo
              await saveScript(scriptCopy);
              result.scriptsImported++;
            }
          }
        }
      }
      
      // Importar configurações
      if (options.importSettings && backupData.settings) {
        await saveSettings(backupData.settings);
        result.settingsImported = true;
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao importar scripts:', error);
      throw error;
    }
  }

  return {
    getScripts,
    getScriptById,
    saveScript,
    deleteScript,
    getSettings,
    saveSettings,
    resetSettings,
    verifyLicenseKey,
    saveLicenseKey,
    exportScripts,
    importScripts
  };
})();