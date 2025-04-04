/**
 * Módulo de configurações
 * Gerencia a interface do usuário e a lógica para as configurações da aplicação
 */
const SettingsModule = (function() {
  // Estado do módulo
  let settings = null;
  let isDirty = false;
  
  /**
   * Inicializa o gerenciador de configurações
   * @param {Object} initialSettings Configurações iniciais
   * @param {Function} onSettingsChanged Callback para quando as configurações mudarem
   */
  function init(initialSettings, onSettingsChanged) {
    settings = initialSettings;
    
    // Preencher campos com valores iniciais
    populateFields();
    
    // Configurar eventos
    setupEventListeners(onSettingsChanged);
  }
  
  /**
   * Preenche os campos da interface com os valores das configurações
   */
  function populateFields() {
    if (!settings) return;
    
    // Ambiente de execução padrão
    document.getElementById('default-execution-environment').value = settings.defaultExecutionEnvironment;
    
    // Configurações do editor
    document.getElementById('editor-theme').value = settings.editorTheme;
    document.getElementById('font-size').value = settings.fontSize;
    document.getElementById('tab-size').value = settings.tabSize;
    
    // Modo escuro e tela cheia
    const darkModeCheckbox = document.getElementById('dark-mode');
    if (darkModeCheckbox) {
      darkModeCheckbox.checked = settings.darkMode || false;
    }
    
    const fullscreenEditorCheckbox = document.getElementById('fullscreen-editor');
    if (fullscreenEditorCheckbox) {
      fullscreenEditorCheckbox.checked = settings.fullscreenEditor || false;
    }
    
    // Licença
    const licenseKeyInput = document.getElementById('license-key');
    if (licenseKeyInput) {
      licenseKeyInput.value = settings.licenseKey || '';
      
      // Mostrar status da licença se houver uma chave
      if (settings.licenseKey && settings.licenseStatus) {
        const licenseStatusDiv = document.getElementById('license-status');
        if (licenseStatusDiv) {
          licenseStatusDiv.style.display = 'block';
          
          if (settings.licenseStatus === 'valid') {
            licenseStatusDiv.className = 'license-status license-valid';
            licenseStatusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Chave de licença válida! Todos os recursos estão habilitados.';
          } else if (settings.licenseStatus === 'invalid') {
            licenseStatusDiv.className = 'license-status license-invalid';
            licenseStatusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Chave de licença inválida. Por favor, verifique e tente novamente.';
          } else {
            licenseStatusDiv.style.display = 'none';
          }
        }
      }
    }
    
    // Servidor local
    document.getElementById('use-local-helper').checked = settings.useLocalHelper;
    document.getElementById('local-server-port').value = settings.localServerPort;
    document.getElementById('local-server-settings').style.display = settings.useLocalHelper ? 'block' : 'none';
    
    // Segurança
    document.getElementById('elevated-permissions').checked = settings.elevatedPermissions;
    document.getElementById('domain-whitelist').value = settings.domainWhitelist.join('\n');
    
    // Novas opções de segurança
    const safeModeCheckbox = document.getElementById('safe-mode');
    if (safeModeCheckbox) {
      safeModeCheckbox.checked = settings.safeMode || false;
    }
    
    const sandboxScriptsCheckbox = document.getElementById('sandbox-scripts');
    if (sandboxScriptsCheckbox) {
      sandboxScriptsCheckbox.checked = settings.sandboxScripts || false;
    }
    
    // Configurações avançadas
    const timeoutInput = document.getElementById('script-execution-timeout');
    if (timeoutInput) {
      timeoutInput.value = settings.scriptExecutionTimeout || 5000;
    }
    
    const autoSaveCheckbox = document.getElementById('auto-save-scripts');
    if (autoSaveCheckbox) {
      autoSaveCheckbox.checked = settings.autoSaveScripts || false;
    }
    
    const enableLogsCheckbox = document.getElementById('enable-script-logs');
    if (enableLogsCheckbox) {
      enableLogsCheckbox.checked = settings.enableScriptLogs || false;
    }
    
    const browserSpecificCheckbox = document.getElementById('browser-specific-injection');
    if (browserSpecificCheckbox) {
      browserSpecificCheckbox.checked = settings.browserSpecificInjection || false;
    }
  }
  
  /**
   * Configura os listeners de eventos para os campos de configuração
   * @param {Function} onSettingsChanged Callback para quando as configurações mudarem
   */
  function setupEventListeners(onSettingsChanged) {
    // Salvar configurações
    document.getElementById('save-settings-btn').addEventListener('click', () => {
      saveSettings(onSettingsChanged);
    });
    
    // Restaurar padrões
    document.getElementById('reset-settings-btn').addEventListener('click', () => {
      resetSettings(onSettingsChanged);
    });
    
    // Mostrar/esconder configurações do servidor local
    document.getElementById('use-local-helper').addEventListener('change', function() {
      document.getElementById('local-server-settings').style.display = this.checked ? 'block' : 'none';
      markDirty();
    });
    
    // Verificação de licença
    const verifyLicenseBtn = document.getElementById('verify-license-btn');
    if (verifyLicenseBtn) {
      verifyLicenseBtn.addEventListener('click', async () => {
        const licenseKeyInput = document.getElementById('license-key');
        const licenseStatusDiv = document.getElementById('license-status');
        
        if (licenseKeyInput && licenseStatusDiv) {
          const key = licenseKeyInput.value.trim();
          
          if (!key) {
            licenseStatusDiv.style.display = 'block';
            licenseStatusDiv.className = 'license-status license-invalid';
            licenseStatusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Digite uma chave de licença válida.';
            return;
          }
          
          // Mostrar estado de carregamento
          licenseStatusDiv.style.display = 'block';
          licenseStatusDiv.className = 'license-status license-verifying';
          licenseStatusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando chave...';
          
          try {
            const isValid = await StorageModule.verifyLicenseKey(key);
            
            if (isValid) {
              // Salvar a chave se for válida
              await StorageModule.saveLicenseKey(key);
              settings.licenseKey = key;
              settings.licenseStatus = 'valid';
              
              licenseStatusDiv.className = 'license-status license-valid';
              licenseStatusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Chave de licença válida! Todos os recursos estão habilitados.';
              showToast('Chave de licença ativada com sucesso', 'success');
              markDirty();
            } else {
              licenseStatusDiv.className = 'license-status license-invalid';
              licenseStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Chave de licença inválida. Por favor, verifique e tente novamente.';
              showToast('Chave de licença inválida', 'error');
            }
          } catch (error) {
            console.error('Erro ao verificar chave:', error);
            licenseStatusDiv.className = 'license-status license-error';
            licenseStatusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro ao verificar a chave. Verifique sua conexão e tente novamente.';
          }
        }
      });
    }
    
    // Marcar como "sujo" quando qualquer campo for alterado
    const allInputs = document.querySelectorAll('#definitions-tab input, #definitions-tab select, #definitions-tab textarea');
    allInputs.forEach(input => {
      input.addEventListener('change', markDirty);
      if (input.tagName === 'TEXTAREA' || input.type === 'text' || input.type === 'number') {
        input.addEventListener('input', markDirty);
      }
    });
  }
  
  /**
   * Marca as configurações como modificadas
   */
  function markDirty() {
    isDirty = true;
    document.getElementById('save-settings-btn').disabled = false;
  }
  
  /**
   * Salva as configurações
   * @param {Function} onSettingsChanged Callback para quando as configurações mudarem
   */
  async function saveSettings(onSettingsChanged) {
    try {
      // Capturar valores dos campos
      const newSettings = {
        defaultExecutionEnvironment: document.getElementById('default-execution-environment').value,
        editorTheme: document.getElementById('editor-theme').value,
        fontSize: document.getElementById('font-size').value,
        tabSize: parseInt(document.getElementById('tab-size').value),
        useLocalHelper: document.getElementById('use-local-helper').checked,
        localServerPort: parseInt(document.getElementById('local-server-port').value),
        elevatedPermissions: document.getElementById('elevated-permissions').checked,
        domainWhitelist: document.getElementById('domain-whitelist').value
          .split('\n')
          .map(line => line.trim())
          .filter(line => line !== ''),
        darkMode: document.getElementById('dark-mode')?.checked || false,
        fullscreenEditor: document.getElementById('fullscreen-editor')?.checked || false,
        
        // Novas opções de segurança
        safeMode: document.getElementById('safe-mode')?.checked || false,
        sandboxScripts: document.getElementById('sandbox-scripts')?.checked || false,
        
        // Configurações avançadas
        scriptExecutionTimeout: parseInt(document.getElementById('script-execution-timeout')?.value || 5000),
        autoSaveScripts: document.getElementById('auto-save-scripts')?.checked || false,
        enableScriptLogs: document.getElementById('enable-script-logs')?.checked || false,
        browserSpecificInjection: document.getElementById('browser-specific-injection')?.checked || false,
        
        // Licença - preservar os valores existentes, porque a verificação é feita separadamente
        licenseKey: settings.licenseKey || '',
        licenseStatus: settings.licenseStatus || 'not_verified'
      };
      
      // Salvar configurações no armazenamento
      const updatedSettings = await StorageModule.saveSettings(newSettings);
      settings = updatedSettings;
      
      // Chamar callback
      if (typeof onSettingsChanged === 'function') {
        onSettingsChanged(updatedSettings);
      }
      
      // Atualizar UI
      isDirty = false;
      document.getElementById('save-settings-btn').disabled = true;
      
      showToast('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showToast('Erro ao salvar configurações', 'error');
    }
  }
  
  /**
   * Redefine as configurações para os padrões
   * @param {Function} onSettingsChanged Callback para quando as configurações mudarem
   */
  async function resetSettings(onSettingsChanged) {
    try {
      if (!confirm('Tem certeza que deseja restaurar todas as configurações para os valores padrão?')) {
        return;
      }
      
      const defaultSettings = await StorageModule.resetSettings();
      settings = defaultSettings;
      
      // Preencher campos
      populateFields();
      
      // Chamar callback
      if (typeof onSettingsChanged === 'function') {
        onSettingsChanged(defaultSettings);
      }
      
      // Atualizar UI
      isDirty = false;
      document.getElementById('save-settings-btn').disabled = true;
      
      showToast('Configurações restauradas com sucesso');
    } catch (error) {
      console.error('Erro ao restaurar configurações:', error);
      showToast('Erro ao restaurar configurações', 'error');
    }
  }
  
  /**
   * Exibe uma mensagem toast
   * @param {string} message Mensagem a exibir
   * @param {string} type Tipo de toast (success, error, warning)
   */
  function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Selecionar ícone adequado
    let iconSvg = '';
    if (type === 'success') iconSvg = SVGIcons.success;
    else if (type === 'error') iconSvg = SVGIcons.error;
    else if (type === 'warning') iconSvg = SVGIcons.warning;
    else iconSvg = SVGIcons.info;
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.innerHTML = iconSvg;
    
    toast.appendChild(iconSpan);
    toast.appendChild(document.createTextNode(' ' + message));
    
    toastContainer.appendChild(toast);
    
    // Remover após 3 segundos
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toastContainer.removeChild(toast);
      }, 300);
    }, 3000);
  }
  
  // API pública do módulo
  return {
    init,
    saveSettings,
    resetSettings
  };
})();