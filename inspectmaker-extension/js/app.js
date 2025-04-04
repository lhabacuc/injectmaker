/**
 * Arquivo principal da aplicação
 * Inicializa e coordena os diferentes módulos
 */
document.addEventListener('DOMContentLoaded', () => {
  // Variáveis globais
  let settings = null;
  
  /**
   * Carrega as configurações e inicializa a aplicação
   */
  async function initApp() {
    try {
      // Carregar configurações
      settings = await StorageModule.getSettings();
      
      // Inicializar módulos
      ScriptsModule.init(settings);
      SettingsModule.init(settings, onSettingsChanged);
      
      // Inicializar navegação por abas
      initTabNavigation();
      
      // Inicializar controles de modo escuro e tela cheia
      initDarkMode();
      initFullscreen();
      
      // Inicializar botões de backup
      initBackupButtons();
      
      // Inicializar ícones SVG
      initSvgIcons();
      
      // Inicializar listener para mensagens de background
      initMessageListener();
      
      // Adicionar estilos para toast
      addToastStyles();
      
      console.log('InspectMaker inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar InspectMaker:', error);
      showToast('Erro ao inicializar a aplicação', 'error');
    }
  }
  
  /**
   * Inicializa o controle de modo escuro
   */
  function initDarkMode() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const darkModeCheckbox = document.getElementById('dark-mode');
    
    // Aplicar configuração inicial
    if (settings.darkMode) {
      document.body.classList.add('dark-mode');
      if (darkModeCheckbox) darkModeCheckbox.checked = true;
    }
    
    // Botão de alternância no cabeçalho
    if (darkModeToggle) {
      darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Checkbox nas configurações
    if (darkModeCheckbox) {
      darkModeCheckbox.addEventListener('change', function() {
        const isDarkMode = this.checked;
        if (isDarkMode !== document.body.classList.contains('dark-mode')) {
          toggleDarkMode();
        }
      });
    }
  }
  
  /**
   * Alterna o modo escuro
   */
  function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    const darkModeCheckbox = document.getElementById('dark-mode');
    
    // Atualizar checkbox se existir
    if (darkModeCheckbox) {
      darkModeCheckbox.checked = isDarkMode;
    }
    
    // Atualizar configurações
    settings.darkMode = isDarkMode;
    StorageModule.saveSettings({ darkMode: isDarkMode });
    
    // Atualizar ícone
    const darkModeIcon = document.querySelector('#dark-mode-toggle i');
    if (darkModeIcon) {
      darkModeIcon.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    showToast(`Modo escuro ${isDarkMode ? 'ativado' : 'desativado'}`, 'success');
  }
  
  /**
   * Inicializa o controle de tela cheia
   */
  function initFullscreen() {
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    const fullscreenCheckbox = document.getElementById('fullscreen-editor');
    
    // Aplicar configuração inicial
    if (settings.fullscreenEditor) {
      document.body.classList.add('fullscreen-mode');
      if (fullscreenCheckbox) fullscreenCheckbox.checked = true;
    }
    
    // Botão de alternância no cabeçalho
    if (fullscreenToggle) {
      fullscreenToggle.addEventListener('click', toggleFullscreen);
    }
    
    // Checkbox nas configurações
    if (fullscreenCheckbox) {
      fullscreenCheckbox.addEventListener('change', function() {
        const isFullscreen = this.checked;
        if (isFullscreen !== document.body.classList.contains('fullscreen-mode')) {
          toggleFullscreen();
        }
      });
    }
  }
  
  /**
   * Alterna o modo de tela cheia
   */
  function toggleFullscreen() {
    const isFullscreen = document.body.classList.contains('fullscreen-mode');
    
    if (isFullscreen) {
      // Desativar modo tela cheia
      document.body.classList.remove('fullscreen-mode');
      
      // Atualizar checkbox se existir
      const fullscreenCheckbox = document.getElementById('fullscreen-editor');
      if (fullscreenCheckbox) {
        fullscreenCheckbox.checked = false;
      }
      
      // Atualizar configurações
      settings.fullscreenEditor = false;
      StorageModule.saveSettings({ fullscreenEditor: false });
      
      // Atualizar ícone
      const fullscreenIcon = document.querySelector('#fullscreen-toggle #expand-icon');
      if (fullscreenIcon) {
        fullscreenIcon.innerHTML = SVGIcons.expand;
      }
      
      showToast('Modo tela cheia desativado', 'success');
      
    } else {
      // Abrir em uma nova janela do navegador
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html?fullscreen=true'),
        type: 'popup',
        width: 1200,
        height: 800
      }, (win) => {
        // Atualizar configurações
        settings.fullscreenEditor = true;
        StorageModule.saveSettings({ fullscreenEditor: true });
        showToast('Abrindo InspectMaker em tela cheia', 'success');
      });
      
      // Atualizar checkbox se existir
      const fullscreenCheckbox = document.getElementById('fullscreen-editor');
      if (fullscreenCheckbox) {
        fullscreenCheckbox.checked = true;
      }
    }
  }
  
  /**
   * Inicializa a navegação por abas
   */
  function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Desativar todas as abas
        document.querySelectorAll('.tab-button').forEach(btn => {
          btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Ativar a aba selecionada
        button.classList.add('active');
        const tabName = button.getAttribute('data-tab');
        document.getElementById(`${tabName}-tab`).classList.add('active');
      });
    });
  }
  
  /**
   * Callback quando as configurações são alteradas
   * @param {Object} newSettings Novas configurações
   */
  function onSettingsChanged(newSettings) {
    settings = newSettings;
    
    // Aplicar modo escuro se ativado
    if (newSettings.darkMode) {
      document.body.classList.add('dark-mode');
      const darkModeIcon = document.querySelector('#dark-mode-toggle #moon-icon');
      if (darkModeIcon) {
        darkModeIcon.innerHTML = SVGIcons.sun;
      }
    } else {
      document.body.classList.remove('dark-mode');
      const darkModeIcon = document.querySelector('#dark-mode-toggle #moon-icon');
      if (darkModeIcon) {
        darkModeIcon.innerHTML = SVGIcons.moon;
      }
    }
    
    // Aplicar tela cheia se ativada
    if (newSettings.fullscreenEditor) {
      document.body.classList.add('fullscreen-mode');
      const fullscreenIcon = document.querySelector('#fullscreen-toggle #expand-icon');
      if (fullscreenIcon) {
        fullscreenIcon.innerHTML = SVGIcons.collapse;
      }
    } else {
      document.body.classList.remove('fullscreen-mode');
      const fullscreenIcon = document.querySelector('#fullscreen-toggle #expand-icon');
      if (fullscreenIcon) {
        fullscreenIcon.innerHTML = SVGIcons.expand;
      }
    }
    
    console.log('Configurações atualizadas:', newSettings);
  }
  
  /**
   * Inicializa os ícones SVG
   */
  function initSvgIcons() {
    // Substituir ícones nas interfaces existentes
    document.querySelectorAll('[id$="-icon"]').forEach(el => {
      const iconType = el.id.replace('-icon', '');
      if (SVGIcons[iconType]) {
        el.innerHTML = SVGIcons[iconType];
      }
    });
    
    // Adicionar ícones de exportação/importação na seção de ajuda
    const helpExportIcon = document.getElementById('help-export-icon');
    const helpImportIcon = document.getElementById('help-import-icon');
    
    if (helpExportIcon) helpExportIcon.innerHTML = SVGIcons.export;
    if (helpImportIcon) helpImportIcon.innerHTML = SVGIcons.import;
    
    // Substituir ícones FontAwesome existentes por SVG
    const iconMappings = {
      'fas fa-moon': 'moon',
      'fas fa-sun': 'sun',
      'fas fa-expand': 'expand',
      'fas fa-compress': 'collapse',
      'fas fa-plus': 'plus',
      'fas fa-save': 'save',
      'fas fa-play': 'play',
      'fas fa-trash-alt': 'trash',
      'fas fa-edit': 'edit',
      'fas fa-cog': 'settings',
      'fas fa-undo': 'reset'
    };
    
    document.querySelectorAll('i[class^="fas fa-"]').forEach(el => {
      const faClass = el.className;
      const svgName = iconMappings[faClass];
      
      if (svgName && SVGIcons[svgName]) {
        const span = document.createElement('span');
        span.className = 'icon';
        span.innerHTML = SVGIcons[svgName];
        el.parentNode.replaceChild(span, el);
      }
    });
  }
  
  /**
   * Inicializa o listener para mensagens de background
   */
  function initMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'highlightLicenseField') {
        // Destacar o campo de licença
        const licenseSection = document.querySelector('.license-section');
        if (licenseSection) {
          licenseSection.classList.add('license-highlight');
          
          // Abrir a aba de configurações se não estiver aberta
          const definitionsTab = document.querySelector('[data-tab="definitions"]');
          if (definitionsTab && !definitionsTab.classList.contains('active')) {
            definitionsTab.click();
          }
          
          // Rolar até a seção de licença
          licenseSection.scrollIntoView({ behavior: 'smooth' });
          
          // Remover destaque após 10 segundos
          setTimeout(() => {
            licenseSection.classList.remove('license-highlight');
          }, 10000);
        }
        
        // Enviar resposta para confirmar recebimento
        sendResponse({ success: true });
        return true; // Indica que a resposta será enviada assincronamente
      }
    });
  }
  
  /**
   * Adiciona estilos CSS para toast
   */
  function addToastStyles() {
    // Já incluídos no CSS principal
  }
  
  /**
   * Inicializa os botões de importação e exportação
   */
  function initBackupButtons() {
    const exportBtn = document.getElementById('export-scripts-btn');
    const importBtn = document.getElementById('import-scripts-btn');
    const exportIcon = document.getElementById('export-icon');
    const importIcon = document.getElementById('import-icon');
    
    // Definir ícones
    exportIcon.innerHTML = SVGIcons.export;
    importIcon.innerHTML = SVGIcons.import;
    
    // Adicionar event listeners
    exportBtn.addEventListener('click', () => {
      ScriptsModule.exportScriptsToFile();
    });
    
    importBtn.addEventListener('click', () => {
      ScriptsModule.importScriptsFromFile();
    });
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
  
  // Inicializar a aplicação
  initApp();
});