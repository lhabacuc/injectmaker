/**
 * Módulo de scripts
 * Gerencia a interface do usuário e a lógica para manipulação de scripts
 */
const ScriptsModule = (function() {
  // Estado do módulo
  let scripts = [];
  let selectedScriptId = null;
  let codeEditor = null;
  let settings = null;
  let isEditing = false;
  let scriptLogs = {};
  let hasValidLicense = false; // Controle de licença
  
  /**
   * Inicializa o gerenciador de scripts
   * @param {Object} appSettings As configurações da aplicação
   */
  function init(appSettings) {
    settings = appSettings;
    
    // Verificar licença
    hasValidLicense = appSettings.licenseKey && appSettings.licenseStatus === 'valid';
    
    // Listeners dos botões com verificação de licença
    document.getElementById('new-script-btn').addEventListener('click', () => {
      if (!hasValidLicense) {
        showLicenseErrorMessage();
        return;
      }
      createNewScript();
    });
    
    // Listener para botões de exclusão de script (delegação de eventos)
    document.getElementById('script-list').addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.script-delete-btn');
      if (deleteBtn) {
        if (!hasValidLicense) {
          showLicenseErrorMessage();
          return;
        }
        const scriptId = parseInt(deleteBtn.dataset.id, 10);
        if (scriptId) {
          deleteScriptWithConfirmation(scriptId);
        }
      }
    });
    
    document.getElementById('edit-script-btn').addEventListener('click', () => {
      if (!hasValidLicense) {
        showLicenseErrorMessage();
        return;
      }
      isEditing = true;
      updateEditMode();
    });
    
    document.getElementById('save-script-btn').addEventListener('click', () => {
      if (!hasValidLicense) {
        showLicenseErrorMessage();
        return;
      }
      const selectedScript = scripts.find(s => s.id === selectedScriptId);
      if (selectedScript) {
        saveScript(selectedScript);
      }
    });
    
    document.getElementById('run-script-btn').addEventListener('click', () => {
      if (!hasValidLicense) {
        showLicenseErrorMessage();
        return;
      }
      const selectedScript = scripts.find(s => s.id === selectedScriptId);
      if (selectedScript) {
        runScript(selectedScript);
      }
    });
    
    // Listener para botão de injeção de script
    document.getElementById('inject-script-btn').addEventListener('click', () => {
      if (!hasValidLicense) {
        showLicenseErrorMessage();
        return;
      }
      const selectedScript = scripts.find(s => s.id === selectedScriptId);
      if (selectedScript) {
        injectScript(selectedScript);
      }
    });
    
    // Listener para botão de remoção de injeção
    document.getElementById('remove-injection-btn').addEventListener('click', () => {
      if (!hasValidLicense) {
        showLicenseErrorMessage();
        return;
      }
      const selectedScript = scripts.find(s => s.id === selectedScriptId);
      if (selectedScript) {
        removeInjection(selectedScript);
      }
    });
    
    // Listeners das abas
    const scriptTabButtons = document.querySelectorAll('.script-tab-button');
    scriptTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-script-tab');
        activateScriptTab(tabName);
      });
    });
    
    // Listener de busca
    document.getElementById('search-scripts').addEventListener('input', filterScripts);
    
    // Inicializar o módulo
    loadScripts();
    
    // Listeners de configuração do script
    document.getElementById('injection-mode').addEventListener('change', function() {
      const selectedScript = scripts.find(s => s.id === selectedScriptId);
      if (selectedScript) {
        selectedScript.injectionMode = this.value;
        updateConditionalSettings(selectedScript);
      }
    });
  }
  
  /**
   * Carrega scripts do armazenamento
   */
  async function loadScripts() {
    try {
      scripts = await StorageModule.getScripts();
      renderScriptLists();
      
      // Selecionar o primeiro script, se houver algum
      if (scripts.length > 0 && !selectedScriptId) {
        selectScript(scripts[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar scripts:', error);
      showToast('Erro ao carregar scripts', 'error');
    }
  }
  
  /**
   * Renderiza as listas de scripts (ativos e inativos)
   */
  function renderScriptLists() {
    const scriptList = document.getElementById('script-list');
    if (!scriptList) {
      console.error('Elemento script-list não encontrado no DOM');
      return;
    }
    
    // Limpar lista anterior
    scriptList.innerHTML = '';
    
    const emptyMessage = document.getElementById('empty-scripts-message');
    
    if (scripts.length === 0) {
      // Se não há scripts, mostrar mensagem de vazio
      if (emptyMessage) {
        emptyMessage.classList.remove('hidden');
      } else {
        // Se o elemento mensagem não existe, criá-lo dinamicamente
        const emptyElement = document.createElement('div');
        emptyElement.id = 'empty-scripts-message';
        emptyElement.className = 'empty-list';
        emptyElement.innerHTML = `
          <i class="fas fa-scroll"></i>
          <p>Nenhum script encontrado</p>
          <p>Crie seu primeiro script clicando no botão abaixo</p>
        `;
        scriptList.appendChild(emptyElement);
      }
      return;
    }
    
    // Se temos scripts, esconder mensagem de vazio
    if (emptyMessage) {
      emptyMessage.classList.add('hidden');
    }
    
    // Ordenar scripts: primeiro os ativos, depois por última edição
    const sortedScripts = [...scripts].sort((a, b) => {
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1;
      }
      return new Date(b.lastEdited) - new Date(a.lastEdited);
    });
    
    // Adicionar cada script à lista
    sortedScripts.forEach(script => {
      const scriptElement = createScriptListItem(script);
      scriptList.appendChild(scriptElement);
    });
  }
  
  /**
   * Cria um item de lista de script a partir do template
   * @param {Object} script O script para renderizar
   * @returns {HTMLElement} O elemento da lista
   */
  function createScriptListItem(script) {
    const scriptElement = document.createElement('div');
    scriptElement.className = `script-item ${selectedScriptId === script.id ? 'active' : ''}`;
    scriptElement.dataset.id = script.id;
    
    const injectionInfo = getInjectionModeInfo(script.injectionMode);
    
    scriptElement.innerHTML = `
      <div class="script-item-header">
        <div class="script-name">${script.name}</div>
        <div class="script-status">
          <i class="fas fa-${script.enabled ? 'check-circle' : 'times-circle'}" 
             style="color: ${script.enabled ? 'var(--success-color)' : 'var(--error-color)'};"></i>
        </div>
      </div>
      <div>
        <div class="script-badge" title="${injectionInfo.label}">
          <i class="fas fa-${injectionInfo.icon}"></i>
          ${injectionInfo.label}
        </div>
        <div class="script-badge" title="Ambiente: ${script.executionEnvironment === 'browser' ? 'Navegador' : 
                                           script.executionEnvironment === 'pc' ? 'PC' : 'Navegador+PC'}">
          <i class="fas fa-${script.executionEnvironment === 'browser' ? 'globe' : 
                            script.executionEnvironment === 'pc' ? 'desktop' : 'code-branch'}"></i>
          ${script.executionEnvironment === 'browser' ? 'Navegador' : 
            script.executionEnvironment === 'pc' ? 'PC' : 'Nav+PC'}
        </div>
      </div>
      <div class="script-item-footer">
        <div class="script-last-edited" style="font-size: 10px; color: #718096;">
          Editado: ${formatLastEdited(script.lastEdited)}
        </div>
        <button class="script-delete-btn" title="Excluir script" data-id="${script.id}">
          <span class="icon" id="trash-icon-${script.id}"></span>
        </button>
      </div>
    `;
    
    scriptElement.addEventListener('click', (e) => {
      // Ignorar o clique se o botão de excluir foi clicado
      if (e.target.closest('.script-delete-btn')) {
        return;
      }
      selectScript(script.id);
    });
    
    // Adicionar o ícone SVG de lixeira após o elemento ser adicionado ao DOM
    setTimeout(() => {
      const trashIcon = document.getElementById(`trash-icon-${script.id}`);
      if (trashIcon) {
        trashIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
      }
      
      // Adicionar evento de clique ao botão de exclusão
      const deleteButton = scriptElement.querySelector('.script-delete-btn');
      if (deleteButton) {
        deleteButton.addEventListener('click', (event) => {
          event.stopPropagation(); // Impedir que o clique seja propagado para o item do script
          deleteScriptWithConfirmation(script.id);
        });
      }
    }, 0);
    
    return scriptElement;
  }
  
  /**
   * Cria um novo script
   */
  function createNewScript() {
    // Obter data atual formatada
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('pt-BR');
    
    // Criar cabeçalho obrigatório com data atual e nome do script
    const headerTemplate = 
`//╔════════════════════════════════════════════╗
//║           ✨ Liedson / sudo ✨              ║
//║                                          ║
//║        📅 Data Atual: ${dateStr}        ║
//║        📝 Nome do Script: Novo Script     ║
//║                                          ║
//╚═════════════════════ 723 ═════════════════╝

// Seu código JavaScript aqui
console.log("Olá do InspectMaker!");`;

    const newScript = {
      name: 'Novo Script',
      code: headerTemplate,
      enabled: true,
      injectionMode: 'instantaneous',
      executionEnvironment: settings.defaultExecutionEnvironment,
      urlPatterns: [],
      lastEdited: new Date().toISOString(),
      browserSpecificInjection: {
        chrome: 'standard',
        firefox: 'standard',
        edge: 'standard',
        safari: 'standard'
      },
      urlPatternsEnabled: [] // Para controlar quais padrões estão ativos
    };
    
    StorageModule.saveScript(newScript)
      .then(savedScript => {
        scripts.push(savedScript);
        renderScriptLists();
        selectScript(savedScript.id);
        isEditing = true;
        updateEditMode();
        showToast('Novo script criado com sucesso');
      })
      .catch(error => {
        console.error('Erro ao criar script:', error);
        showToast('Erro ao criar script', 'error');
      });
  }
  
  /**
   * Seleciona um script para exibição ou edição
   * @param {number} id ID do script a selecionar
   */
  async function selectScript(id) {
    // Desmarcar item anterior
    const previousActive = document.querySelector('.script-item.active');
    if (previousActive) {
      previousActive.classList.remove('active');
    }
    
    // Marcar novo item como ativo
    const scriptItem = document.querySelector(`.script-item[data-id="${id}"]`);
    if (scriptItem) {
      scriptItem.classList.add('active');
    }
    
    selectedScriptId = id;
    const script = scripts.find(s => s.id === id);
    
    if (script) {
      // Mostrar conteúdo de detalhes
      document.getElementById('no-selection-message').classList.add('hidden');
      document.getElementById('script-detail-content').classList.remove('hidden');
      
      // Renderizar detalhes do script
      renderScriptEditor(script);
      
      // Preencher campos de configuração com verificação de nulos
      const scriptNameEl = document.getElementById('script-name');
      if (scriptNameEl) scriptNameEl.value = script.name;
      
      const scriptEnabledEl = document.getElementById('script-enabled');
      if (scriptEnabledEl) scriptEnabledEl.checked = script.enabled;
      
      const injectionModeEl = document.getElementById('injection-mode');
      if (injectionModeEl) injectionModeEl.value = script.injectionMode;
      
      const execEnvEl = document.getElementById('execution-environment');
      if (execEnvEl) execEnvEl.value = script.executionEnvironment;
      
      // Atualizar campos condicionais
      updateConditionalSettings(script);
      
      // Preencher padrões de URL
      document.getElementById('url-patterns').value = script.urlPatterns.join('\n');
      
      // Exibir logs
      renderScriptLogs(id);
      
      // Iniciar no modo visualização
      isEditing = false;
      updateEditMode();
    }
  }
  
  /**
   * Renderiza o editor de scripts para um script específico
   * @param {Object} script O script para editar
   */
  function renderScriptEditor(script) {
    // Limpar editor atual, se existir
    const editorContainer = document.getElementById('code-editor');
    editorContainer.innerHTML = '';
    
    // Inicializar CodeMirror
    initCodeEditor(script);
  }
  
  /**
   * Inicializa o editor de código CodeMirror
   * @param {Object} script O script a ser editado
   */
  function initCodeEditor(script) {
    const editorContainer = document.getElementById('code-editor');
    
    // Determinar o tema apropriado com base nas configurações
    let editorTheme = settings.editorTheme;
    
    // Se o modo escuro estiver ativado, usar um tema escuro como monokai
    if (settings.darkMode && (editorTheme === 'default' || editorTheme === 'light')) {
      editorTheme = 'monokai';
    }
    
    codeEditor = CodeMirror(editorContainer, {
      value: script.code,
      mode: 'javascript',
      theme: editorTheme,
      lineNumbers: true,
      matchBrackets: true,
      indentUnit: parseInt(settings.tabSize),
      tabSize: parseInt(settings.tabSize),
      indentWithTabs: false,
      readOnly: !isEditing,
      autoCloseBrackets: true,
      styleActiveLine: true,
      // Adicionar recursos avançados de edição
      extraKeys: {
        "Ctrl-Space": "autocomplete", // Autocomplete manual
        "Alt-.": "autocomplete", // Alternativa para autocomplete
        "Tab": function(cm) {
          if (cm.somethingSelected()) {
            cm.indentSelection("add");
          } else {
            cm.replaceSelection(Array(cm.getOption("indentUnit") + 1).join(" "), "end", "+input");
          }
        },
        "Ctrl-/": function(cm) {
          // Comentar/descomentar código
          const ranges = cm.listSelections();
          const lineCommentStart = "// ";
          
          for (let i = 0; i < ranges.length; i++) {
            const from = ranges[i].from();
            const to = ranges[i].to();
            
            // Comentar múltiplas linhas
            if (from.line !== to.line) {
              for (let line = from.line; line <= to.line; line++) {
                const lineText = cm.getLine(line);
                if (lineText.startsWith(lineCommentStart)) {
                  cm.replaceRange("", {line: line, ch: 0}, {line: line, ch: lineCommentStart.length});
                } else {
                  cm.replaceRange(lineCommentStart, {line: line, ch: 0});
                }
              }
            } else {
              // Comentar uma única linha
              const lineText = cm.getLine(from.line);
              if (lineText.startsWith(lineCommentStart)) {
                cm.replaceRange("", {line: from.line, ch: 0}, {line: from.line, ch: lineCommentStart.length});
              } else {
                cm.replaceRange(lineCommentStart, {line: from.line, ch: 0});
              }
            }
          }
        }
      },
      hintOptions: {
        completeSingle: false,
        alignWithWord: true,
        closeOnUnfocus: true,
        words: [
          // API do navegador
          "document", "window", "navigator", "location", "history", "localStorage", "sessionStorage", 
          "console", "fetch", "XMLHttpRequest", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
          
          // InspectMaker APIs
          "inspectMaker", "sendMessageToBackground", "runInPage", "interceptAjax", "fetchResource",
          "onUrlChange", "registerEventHandler", "getElementBySelector", "waitForElement",
          
          // Helpers
          "querySelector", "querySelectorAll", "getElementById", "getElementsByClassName", "createElement",
          "addEventListener", "removeEventListener", "innerHTML", "textContent", "setAttribute", "getAttribute",
          
          // Eventos
          "click", "change", "submit", "load", "DOMContentLoaded", "keydown", "keyup", "mouseover", "mouseout",
          
          // JavaScript moderno
          "async", "await", "Promise", "const", "let", "map", "filter", "reduce", "find", "forEach", "includes",
          "Object.keys", "Object.values", "Object.entries", "JSON.parse", "JSON.stringify"
        ]
      },
      lint: {
        esversion: 11, // ES2020
        asi: true,
        laxbreak: true,
        browser: true,
        devel: true,
        unused: true,
        undef: true
      },
      gutters: ["CodeMirror-lint-markers", "CodeMirror-linenumbers"],
      autoCloseBrackets: true,
      matchTags: {bothTags: true},
      foldGutter: true
    });
    
    // Ativar autocompletar durante a digitação
    codeEditor.on("inputRead", function(cm, change) {
      if (change.origin !== "complete" && !cm.state.completionActive && 
          /^[a-zA-Z0-9_\$\.]$/.test(change.text[0])) {
        cm.showHint({completeSingle: false});
      }
    });
    
    // Ajustar tamanho da fonte
    const cmElement = editorContainer.querySelector('.CodeMirror');
    if (cmElement) {
      cmElement.style.fontSize = settings.fontSize;
      
      // Aplicar classe para modo escuro se necessário
      if (settings.darkMode) {
        cmElement.classList.add('cm-dark-mode');
      } else {
        cmElement.classList.remove('cm-dark-mode');
      }
    }
  }
  
  /**
   * Configura os campos de configurações para o script
   * @param {Object} script O script a configurar
   */
  function setupSettingsFields(script) {
    // Configurar campos com base no script
    document.getElementById('script-name').value = script.name || '';
    document.getElementById('script-enabled').checked = script.enabled || false;
    document.getElementById('injection-mode').value = script.injectionMode || 'instantaneous';
    document.getElementById('execution-environment').value = script.executionEnvironment || 'browser';
    
    // Configurações de injeção específicas por navegador
    if (script.browserSpecificInjection) {
      const browserTypes = ['chrome', 'firefox', 'edge', 'safari'];
      browserTypes.forEach(browser => {
        const selector = document.getElementById(`${browser}-injection-method`);
        if (selector && script.browserSpecificInjection[browser]) {
          selector.value = script.browserSpecificInjection[browser];
        }
      });
    }
    
    // Atualizar campos condicionais com base no modo de injeção
    updateConditionalSettings(script);
    
    // Atualizar lista de padrões de URL
    updateUrlPatternsList(script);
  }
  
  /**
   * Atualiza configurações condicionais baseadas no modo de injeção
   * @param {Object} script O script a configurar
   */
  function updateConditionalSettings(script) {
    // Esconder todas as configurações condicionais
    document.querySelectorAll('.conditional-setting').forEach(el => {
      el.classList.remove('visible');
    });
    
    // Mostrar apenas a relevante para o modo atual
    if (script.injectionMode === 'delayed') {
      const delayedSettings = document.getElementById('delayed-settings');
      if (delayedSettings) {
        delayedSettings.classList.add('visible');
        const delayTimeEl = document.getElementById('delay-time');
        if (delayTimeEl) delayTimeEl.value = script.delayTime || 1000;
      }
    } else if (script.injectionMode === 'eventBased') {
      const eventSettings = document.getElementById('event-settings');
      if (eventSettings) {
        eventSettings.classList.add('visible');
        
        // Configurar o campo de evento
        const eventTriggerEl = document.getElementById('event-trigger');
        if (eventTriggerEl) {
          eventTriggerEl.value = script.eventTrigger || '';
          
          // Mostrar exemplos de código para o evento selecionado
          updateEventExample(script.eventTrigger || '');
        }
        
        // Mostrar lista de eventos predefinidos se existir
        const eventPresetEl = document.getElementById('event-preset');
        if (eventPresetEl) {
          eventPresetEl.addEventListener('change', function() {
            if (this.value && eventTriggerEl) {
              eventTriggerEl.value = this.value;
              updateEventExample(this.value);
            }
          });
        }
      }
    } else if (script.injectionMode === 'persistent') {
      const persistentSettings = document.getElementById('persistent-settings');
      if (persistentSettings) {
        persistentSettings.classList.add('visible');
        const persistentIntervalEl = document.getElementById('persistent-interval');
        if (persistentIntervalEl) persistentIntervalEl.value = script.persistentInterval || 5000;
      }
    }
    
    // Atualizar configurações específicas de navegador
    const browserSettings = document.getElementById('browser-specific-settings');
    if (browserSettings) {
      browserSettings.classList.add('visible');
      
      // Garantir que o objeto browserSpecificInjection existe
      script.browserSpecificInjection = script.browserSpecificInjection || {
        chrome: 'standard',
        firefox: 'standard',
        edge: 'standard',
        safari: 'standard'
      };
      
      // Atualizar seletores de método de injeção para cada navegador
      const browserTypes = ['chrome', 'firefox', 'edge', 'safari'];
      browserTypes.forEach(browser => {
        const methodSelector = document.getElementById(`${browser}-injection-method`);
        if (methodSelector) {
          methodSelector.value = script.browserSpecificInjection[browser] || 'standard';
        }
      });
    }
    
    // Atualizar a lista de URLs com estado de ativação
    updateUrlPatternsList(script);
  }
  
  /**
   * Atualiza a lista de URLs com checkboxes para ativar/desativar
   * @param {Object} script O script contendo os padrões de URL
   */
  function updateUrlPatternsList(script) {
    const urlPatternsList = document.getElementById('url-patterns-list');
    const urlPatternsField = document.getElementById('url-patterns');
    
    if (!urlPatternsList || !urlPatternsField) return;
    
    // Limpar a lista atual
    urlPatternsList.innerHTML = '';
    
    // Adicionar padrões à lista
    if (script.urlPatterns && script.urlPatterns.length > 0) {
      script.urlPatterns.forEach((pattern, index) => {
        // Dividir o padrão em objeto com texto e estado
        let patternObj = { text: pattern, enabled: true };
        
        // Verificar se o padrão já é um objeto (formato avançado)
        if (typeof pattern === 'object' && pattern.text) {
          patternObj = pattern;
        }
        
        // Criar elemento da lista para cada padrão
        const patternItem = document.createElement('div');
        patternItem.className = 'url-pattern-item';
        patternItem.dataset.index = index;
        
        const patternControls = document.createElement('div');
        patternControls.className = 'url-pattern-controls';
        
        // Checkbox para ativar/desativar
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `url-pattern-${index}`;
        checkbox.checked = patternObj.enabled;
        checkbox.addEventListener('change', () => {
          // Atualizar estado do padrão
          if (typeof script.urlPatterns[index] === 'string') {
            // Converter de string para objeto
            script.urlPatterns[index] = {
              text: script.urlPatterns[index],
              enabled: checkbox.checked
            };
          } else {
            // Atualizar objeto existente
            script.urlPatterns[index].enabled = checkbox.checked;
          }
          
          // Atualizar visualização
          updateUrlPatternsList(script);
        });
        
        // Texto do padrão
        const patternText = document.createElement('span');
        patternText.className = 'url-pattern-text';
        patternText.textContent = patternObj.text;
        if (!patternObj.enabled) {
          patternText.classList.add('disabled');
        }
        
        // Botões de ação
        const patternActions = document.createElement('div');
        patternActions.className = 'url-pattern-actions';
        
        // Botão editar
        const editBtn = document.createElement('button');
        editBtn.className = 'url-edit-btn';
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editBtn.title = 'Editar padrão';
        editBtn.addEventListener('click', () => {
          const newPattern = prompt('Editar padrão de URL:', patternObj.text);
          if (newPattern !== null && newPattern.trim() !== '') {
            if (typeof script.urlPatterns[index] === 'string') {
              script.urlPatterns[index] = {
                text: newPattern,
                enabled: true
              };
            } else {
              script.urlPatterns[index].text = newPattern;
            }
            updateUrlPatternsList(script);
          }
        });
        
        // Botão excluir
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'url-delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Remover padrão';
        deleteBtn.addEventListener('click', () => {
          if (confirm(`Deseja remover o padrão "${patternObj.text}"?`)) {
            script.urlPatterns.splice(index, 1);
            updateUrlPatternsList(script);
          }
        });
        
        // Adicionar elementos à estrutura
        patternControls.appendChild(checkbox);
        patternControls.appendChild(patternText);
        patternActions.appendChild(editBtn);
        patternActions.appendChild(deleteBtn);
        patternItem.appendChild(patternControls);
        patternItem.appendChild(patternActions);
        urlPatternsList.appendChild(patternItem);
      });
    }
    
    // Adicionar botão para adicionar novo padrão
    const addButton = document.createElement('button');
    addButton.className = 'add-url-btn';
    addButton.innerHTML = '<i class="fas fa-plus"></i> Adicionar novo padrão de URL';
    addButton.addEventListener('click', () => {
      const newPattern = prompt('Digite o novo padrão de URL:');
      if (newPattern !== null && newPattern.trim() !== '') {
        if (!script.urlPatterns) {
          script.urlPatterns = [];
        }
        script.urlPatterns.push({
          text: newPattern,
          enabled: true
        });
        updateUrlPatternsList(script);
      }
    });
    
    urlPatternsList.appendChild(addButton);
    
    // Atualizar o campo de texto para mostrar os padrões ativos
    const activePatterns = script.urlPatterns
      .filter(p => typeof p === 'string' || p.enabled)
      .map(p => typeof p === 'string' ? p : p.text);
    
    urlPatternsField.value = activePatterns.join('\n');
  }
  
  /**
   * Atualiza o exemplo de código com base no evento selecionado
   * @param {string} eventType Tipo de evento selecionado
   */
  function updateEventExample(eventType) {
    const exampleContainer = document.getElementById('event-code-example');
    if (!exampleContainer) return;
    
    let exampleCode = '';
    
    switch(eventType) {
      case 'click':
        exampleCode = `// Exemplo de uso do evento 'click'
// Este script será executado quando o usuário clicar em qualquer elemento da página
console.log('Elemento clicado:', event.target);

// Você pode verificar classes específicas
if (event.target.classList.contains('button')) {
  console.log('Um botão foi clicado!');
}

// Ou interagir com o elemento
if (event.target.tagName === 'BUTTON') {
  event.target.style.backgroundColor = 'green';
  alert('Botão clicado!');
}`;
        break;
        
      case 'DOMContentLoaded':
        exampleCode = `// Exemplo de uso do evento 'DOMContentLoaded'
// Este script será executado quando o DOM estiver totalmente carregado
// Útil para modificar a página antes que todas as imagens e recursos externos sejam carregados
console.log('DOM carregado!');

// Adicionar elementos ao DOM
const newElement = document.createElement('div');
newElement.textContent = 'Adicionado pelo InspectMaker';
newElement.style.position = 'fixed';
newElement.style.top = '10px';
newElement.style.right = '10px';
newElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
newElement.style.color = 'white';
newElement.style.padding = '5px 10px';
newElement.style.borderRadius = '5px';
newElement.style.zIndex = '9999';
document.body.appendChild(newElement);`;
        break;
        
      case 'load':
        exampleCode = `// Exemplo de uso do evento 'load'
// Este script será executado quando a página inteira, incluindo todos os recursos, estiver carregada
console.log('Página completamente carregada!');

// Você pode acessar recursos como imagens que agora estão completamente carregados
const images = document.querySelectorAll('img');
console.log('Total de imagens carregadas:', images.length);

// Analisar e modificar o conteúdo da página
const h1 = document.querySelector('h1');
if (h1) {
  h1.style.color = 'blue';
  h1.textContent = 'Modificado pelo InspectMaker!';
}`;
        break;
        
      case 'mouseover':
        exampleCode = `// Exemplo de uso do evento 'mouseover'
// Este script será executado quando o mouse passar sobre qualquer elemento
console.log('Mouse sobre:', event.target);

// Destacar o elemento atual
const originalColor = event.target.style.backgroundColor;
event.target.style.backgroundColor = 'yellow';

// Restaurar a cor original quando o mouse sair (você precisaria configurar outro script para isso)
// Em um case real, você poderia preferir usar CSS :hover em vez deste script`;
        break;
        
      case 'submit':
        exampleCode = `// Exemplo de uso do evento 'submit'
// Este script será executado quando um formulário for enviado
console.log('Formulário enviado:', event.target);

// Prevenir o envio padrão do formulário
event.preventDefault();

// Capturar dados do formulário
const formData = new FormData(event.target);
console.log('Dados do formulário:');
for (let [key, value] of formData.entries()) {
  console.log(key + ': ' + value);
}

// Você pode validar dados, modificar valores ou enviar para outro lugar
alert('Formulário interceptado pelo InspectMaker!');

// Para permitir que o formulário continue normalmente, remova event.preventDefault();`;
        break;
        
      case 'storage':
        exampleCode = `// Exemplo de uso do evento 'storage'
// Este script será executado quando o localStorage ou sessionStorage for modificado
console.log('Storage modificado!');
console.log('Chave:', event.key);
console.log('Valor antigo:', event.oldValue);
console.log('Novo valor:', event.newValue);
console.log('URL:', event.url);

// Você pode reagir a mudanças específicas no armazenamento
if (event.key === 'userPreferences') {
  console.log('Preferências do usuário atualizadas!');
}`;
        break;
        
      case 'visibilitychange':
        exampleCode = `// Exemplo de uso do evento 'visibilitychange'
// Este script será executado quando a aba ganhar ou perder foco
console.log('Visibilidade mudou!');

// Verificar o estado atual da página
if (document.hidden) {
  console.log('Página não está visível (aba em segundo plano)');
  // Pausar animações, vídeos, etc.
} else {
  console.log('Página está visível (aba em primeiro plano)');
  // Retomar animações, vídeos, etc.
}`;
        break;
        
      case 'custom:pageReady':
        exampleCode = `// Este é um exemplo de evento personalizado 'pageReady'
// Para que este script funcione, o evento precisa ser disparado em algum lugar da página
// Por exemplo, a página pode ter um código como:
// document.dispatchEvent(new CustomEvent('pageReady', { detail: { version: '1.0' } }));

console.log('Evento personalizado pageReady disparado!');
console.log('Detalhes:', event.detail);

// Você pode reagir aos dados fornecidos no evento
if (event.detail && event.detail.version) {
  console.log('Versão da página:', event.detail.version);
}`;
        break;
        
      case 'custom:ajaxComplete':
        exampleCode = `// Este é um exemplo de evento personalizado 'ajaxComplete'
// Para que este script funcione, o evento precisa ser disparado após requisições AJAX
// Um script anterior pode adicionar este comportamento, por exemplo:

/*
// Código para injetar antes:
(function() {
  const originalXHR = window.XMLHttpRequest;
  function newXHR() {
    const xhr = new originalXHR();
    xhr.addEventListener('load', function() {
      document.dispatchEvent(new CustomEvent('ajaxComplete', { 
        detail: { url: this._url, status: this.status } 
      }));
    });
    const originalOpen = xhr.open;
    xhr.open = function(method, url) {
      this._url = url;
      return originalOpen.apply(this, arguments);
    };
    return xhr;
  }
  window.XMLHttpRequest = newXHR;
})();
*/

console.log('AJAX completado!');
console.log('URL:', event.detail.url);
console.log('Status:', event.detail.status);

// Você pode reagir a requisições específicas
if (event.detail.url.includes('/api/data')) {
  console.log('Dados da API carregados!');
}`;
        break;
        
      case 'custom:elementCreated':
        exampleCode = `// Este é um exemplo de evento personalizado 'elementCreated'
// Para que este script funcione, o evento precisa ser disparado quando elementos forem criados
// Um script anterior pode adicionar este comportamento, por exemplo:

/*
// Código para injetar antes:
(function() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // 1 = Element node
            document.dispatchEvent(new CustomEvent('elementCreated', { 
              detail: { element: node, tagName: node.tagName } 
            }));
          }
        });
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
*/

console.log('Novo elemento criado:', event.detail.tagName);

// Você pode reagir a elementos específicos
if (event.detail.tagName === 'DIV' && event.detail.element.classList.contains('modal')) {
  console.log('Um modal foi criado! Modificando...');
  event.detail.element.style.border = '2px solid red';
}`;
        break;
        
      default:
        exampleCode = `// Digite o nome do evento para ver um exemplo
// Exemplos de eventos comuns: click, DOMContentLoaded, load, submit
// Você também pode usar eventos personalizados`;
    }
    
    exampleContainer.textContent = exampleCode;
  }

  /**
   * Atualiza a interface com base no modo de edição
   */
  function updateEditMode() {
    // Atualizar botões com verificações de nulos
    const editBtn = document.getElementById('edit-script-btn');
    if (editBtn) editBtn.classList.toggle('hidden', isEditing);
    
    const saveBtn = document.getElementById('save-script-btn');
    if (saveBtn) saveBtn.classList.toggle('hidden', !isEditing);
    
    // Atualizar editor
    if (codeEditor) {
      codeEditor.setOption('readOnly', !isEditing);
    }
    
    // Atualizar formulário
    const formInputs = document.querySelectorAll('#script-settings-form input, #script-settings-form select, #script-settings-form textarea');
    formInputs.forEach(input => {
      input.disabled = !isEditing;
    });
  }
  
  /**
   * Ativa uma aba no painel de detalhes do script
   * @param {string} tabName Nome da aba a ativar
   */
  function activateScriptTab(tabName) {
    // Desativar todas as abas
    const tabButtons = document.querySelectorAll('.script-tab-button');
    const tabContents = document.querySelectorAll('.script-tab-content');
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Ativar aba selecionada com verificação de nulos
    const activeTabButton = document.querySelector(`.script-tab-button[data-script-tab="${tabName}"]`);
    if (activeTabButton) activeTabButton.classList.add('active');
    
    const activeTabContent = document.getElementById(`${tabName}-tab`);
    if (activeTabContent) activeTabContent.classList.add('active');
    
    // Ajuste para o editor de código ao mudar para a aba de código
    if (tabName === 'code' && codeEditor) {
      codeEditor.refresh();
    }
    
    // Renderizar logs se a aba for logs
    if (tabName === 'logs' && selectedScriptId) {
      renderScriptLogs(selectedScriptId);
    }
  }
  
  /**
   * Renderiza os logs de um script
   * @param {number} scriptId ID do script
   */
  function renderScriptLogs(scriptId) {
    const logsContainer = document.getElementById('script-logs');
    if (!logsContainer) {
      console.error('Elemento script-logs não encontrado no DOM');
      return;
    }
    
    const logs = scriptLogs[scriptId] || [];
    
    if (logs.length === 0) {
      logsContainer.innerHTML = '<div class="empty-list">Nenhum log disponível para este script</div>';
      return;
    }
    
    logsContainer.innerHTML = '';
    logs.forEach(log => {
      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      logEntry.innerHTML = `
        <span class="log-time">${log.time}</span>
        <span>${log.message}</span>
      `;
      logsContainer.appendChild(logEntry);
    });
  }
  
  /**
   * Salva o script atual
   * @param {Object} script O script a salvar
   */
  async function saveScript(script) {
    try {
      const updatedScript = { ...script };
      
      // Atualizar código do editor
      updatedScript.code = codeEditor.getValue();
      
      // Atualizar campos do formulário
      updatedScript.name = document.getElementById('script-name').value;
      updatedScript.enabled = document.getElementById('script-enabled').checked;
      updatedScript.injectionMode = document.getElementById('injection-mode').value;
      updatedScript.executionEnvironment = document.getElementById('execution-environment').value;
      
      // Capturar configurações condicionais
      if (updatedScript.injectionMode === 'delayed') {
        updatedScript.delayTime = parseInt(document.getElementById('delay-time').value) || 1000;
      } else if (updatedScript.injectionMode === 'eventBased') {
        updatedScript.eventTrigger = document.getElementById('event-trigger').value;
      } else if (updatedScript.injectionMode === 'persistent') {
        updatedScript.persistentInterval = parseInt(document.getElementById('persistent-interval').value) || 5000;
      }
      
      // Capturar padrões de URL e seu estado de ativação
      const urlPatternsText = document.getElementById('url-patterns').value;
      const newUrlPatterns = urlPatternsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
        
      // Manter o estado de ativação para URLs existentes ou definir como ativo para novas
      let urlPatternsEnabled = updatedScript.urlPatternsEnabled || [];
      
      // Atualizar a lista de URLs ativas para conter apenas as URLs presentes
      urlPatternsEnabled = newUrlPatterns.map(url => {
        const existingIndex = updatedScript.urlPatterns.indexOf(url);
        // Se a URL já existia e tinha um estado salvo, manter esse estado
        // Caso contrário, definir como ativa por padrão
        return existingIndex >= 0 && updatedScript.urlPatternsEnabled ? 
          updatedScript.urlPatternsEnabled[existingIndex] || true : 
          true;
      });
      
      updatedScript.urlPatterns = newUrlPatterns;
      updatedScript.urlPatternsEnabled = urlPatternsEnabled;
      
      // Atualizar data da última edição
      updatedScript.lastEdited = new Date().toISOString();
      
      // Capturar configurações específicas de navegador
      const browserTypes = ['chrome', 'firefox', 'edge', 'safari'];
      updatedScript.browserSpecificInjection = updatedScript.browserSpecificInjection || {};
      
      browserTypes.forEach(browser => {
        const methodSelector = document.getElementById(`${browser}-injection-method`);
        if (methodSelector) {
          updatedScript.browserSpecificInjection[browser] = methodSelector.value;
        } else {
          // Se o elemento não existir, manter o valor atual ou definir como padrão
          updatedScript.browserSpecificInjection[browser] = 
            updatedScript.browserSpecificInjection[browser] || 'standard';
        }
      });
      
      // Salvar script atualizado
      const savedScript = await StorageModule.saveScript(updatedScript);
      
      // Atualizar lista de scripts
      const index = scripts.findIndex(s => s.id === savedScript.id);
      if (index !== -1) {
        scripts[index] = savedScript;
      } else {
        scripts.push(savedScript);
      }
      
      // Atualizar interface
      renderScriptLists();
      isEditing = false;
      updateEditMode();
      
      showToast('Script salvo com sucesso');
      
      return savedScript;
    } catch (error) {
      console.error('Erro ao salvar script:', error);
      showToast('Erro ao salvar script', 'error');
      throw error;
    }
  }
  
  /**
   * Executa um script
   * @param {Object} script O script a executar
   */
  function runScript(script) {
    addScriptLog(script.id, 'Solicitação de execução do script...');
    
    // Enviar mensagem para o background script executar
    chrome.runtime.sendMessage(
      { action: 'executeScript', script },
      result => {
        if (chrome.runtime.lastError) {
          addScriptLog(script.id, `Erro: ${chrome.runtime.lastError.message}`);
          showToast('Erro ao executar script', 'error');
          return;
        }
        
        if (result && result.success) {
          addScriptLog(script.id, 'Script executado com sucesso');
          if (result.output) {
            addScriptLog(script.id, `Saída: ${result.output}`);
          }
          showToast('Script executado com sucesso');
        } else {
          addScriptLog(script.id, `Erro: ${result?.error || 'Erro desconhecido'}`);
          showToast('Erro ao executar script', 'error');
        }
      }
    );
  }
  
  /**
   * Ativa a injeção de um script
   * @param {Object} script O script a ser injetado
   */
  function injectScript(script) {
    if (!script) return;
    
    // Verificar se o script está ativado
    if (!script.enabled) {
      showToast('Ative o script nas configurações antes de injetá-lo', 'warning');
      return;
    }
    
    addScriptLog(script.id, 'Solicitação de injeção do script...');
    
    // Enviar mensagem para o background.js para ativar a injeção
    chrome.runtime.sendMessage(
      { action: 'injectScript', script: script },
      function(response) {
        if (chrome.runtime.lastError) {
          addScriptLog(script.id, `Erro ao injetar script: ${chrome.runtime.lastError.message}`);
          showToast(`Erro ao injetar script: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        
        addScriptLog(script.id, 'Script injetado com sucesso');
        showToast('Script injetado com sucesso. Navegue para a página alvo para vê-lo em ação.', 'success');
      }
    );
  }
  
  /**
   * Remove a injeção de um script
   * @param {Object} script O script cuja injeção será removida
   */
  function removeInjection(script) {
    if (!script) return;
    
    addScriptLog(script.id, 'Solicitação de remoção de injeção...');
    
    // Enviar mensagem para o background.js para remover a injeção
    chrome.runtime.sendMessage(
      { action: 'removeInjection', scriptId: script.id },
      function(response) {
        if (chrome.runtime.lastError) {
          addScriptLog(script.id, `Erro ao remover injeção: ${chrome.runtime.lastError.message}`);
          showToast(`Erro ao remover injeção: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        
        addScriptLog(script.id, 'Injeção removida com sucesso');
        showToast('Injeção do script removida com sucesso', 'success');
      }
    );
  }
  
  /**
   * Adiciona uma entrada de log para um script
   * @param {number} scriptId ID do script
   * @param {string} message Mensagem de log
   */
  function addScriptLog(scriptId, message) {
    if (!scriptLogs[scriptId]) {
      scriptLogs[scriptId] = [];
    }
    
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    scriptLogs[scriptId].push({
      time: timeString,
      message: message
    });
    
    // Limitar a um máximo de 100 logs por script
    if (scriptLogs[scriptId].length > 100) {
      scriptLogs[scriptId] = scriptLogs[scriptId].slice(-100);
    }
    
    // Atualizar visualização se estiver na aba de logs
    const logsTab = document.querySelector('.script-tab-button[data-script-tab="logs"]');
    if (logsTab && logsTab.classList.contains('active') && selectedScriptId === scriptId) {
      renderScriptLogs(scriptId);
    }
  }
  
  /**
   * Filtra scripts com base no termo de pesquisa
   */
  function filterScripts() {
    const searchTerm = document.getElementById('search-scripts').value.toLowerCase();
    
    // Se não houver termo de pesquisa, mostrar todos
    if (!searchTerm) {
      document.querySelectorAll('.script-item').forEach(item => {
        item.style.display = 'block';
      });
      return;
    }
    
    // Filtrar pelo nome do script
    document.querySelectorAll('.script-item').forEach(item => {
      const scriptName = item.querySelector('.script-name').textContent.toLowerCase();
      item.style.display = scriptName.includes(searchTerm) ? 'block' : 'none';
    });
  }
  
  /**
   * Formata a data da última edição para exibição
   * @param {string} dateString Data em formato ISO string
   * @returns {string} Data formatada para exibição
   */
  function formatLastEdited(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Data desconhecida';
    }
  }
  
  /**
   * Retorna informações sobre o modo de injeção (ícone e rótulo)
   * @param {string} mode Modo de injeção
   * @returns {Object} Objeto contendo ícone e rótulo
   */
  function getInjectionModeInfo(mode) {
    switch (mode) {
      case 'instantaneous':
        return { icon: 'bolt', label: 'Instantâneo' };
      case 'delayed':
        return { icon: 'clock', label: 'Atrasado' };
      case 'onDemand':
        return { icon: 'hand-pointer', label: 'Sob demanda' };
      case 'eventBased':
        return { icon: 'bell', label: 'Evento' };
      case 'persistent':
        return { icon: 'sync', label: 'Persistente' };
      default:
        return { icon: 'question', label: 'Desconhecido' };
    }
  }
  
  /**
   * Exibe uma mensagem toast
   * @param {string} message Mensagem a exibir
   * @param {string} type Tipo de toast (success, error, warning)
   */
  function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      console.error('Elemento toast-container não encontrado no DOM');
      // Criar um contêiner de toast temporário
      const tempContainer = document.createElement('div');
      tempContainer.id = 'toast-container';
      tempContainer.style.position = 'fixed';
      tempContainer.style.bottom = '20px';
      tempContainer.style.right = '20px';
      tempContainer.style.zIndex = '9999';
      document.body.appendChild(tempContainer);
    }
    
    const containerToUse = document.getElementById('toast-container') || document.body;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.backgroundColor = type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#ff9800';
    toast.style.color = 'white';
    toast.style.padding = '12px 16px';
    toast.style.marginBottom = '10px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.transition = 'opacity 0.3s ease-in-out';
    
    // Selecionar ícone adequado
    let iconSvg = '';
    if (type === 'success') iconSvg = SVGIcons.success;
    else if (type === 'error') iconSvg = SVGIcons.error;
    else if (type === 'warning') iconSvg = SVGIcons.warning;
    else iconSvg = SVGIcons.info;
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.style.marginRight = '8px';
    iconSpan.innerHTML = iconSvg;
    
    toast.appendChild(iconSpan);
    toast.appendChild(document.createTextNode(message));
    
    containerToUse.appendChild(toast);
    
    // Remover após 3 segundos
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (containerToUse.contains(toast)) {
          containerToUse.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
  
  /**
   * Exibe uma mensagem de erro quando a licença é inválida
   */
  function showLicenseErrorMessage() {
    showToast('Licença inválida. Por favor, ative uma licença válida para utilizar esta funcionalidade.', 'error');
    
    // Direcionar para a aba de configurações
    const definitionsTab = document.getElementById('definitions-tab-btn');
    if (definitionsTab) {
      definitionsTab.click();
      
      // Destacar a seção de licença
      const licenseSection = document.querySelector('.settings-section:first-of-type');
      if (licenseSection) {
        licenseSection.style.animation = 'highlight-pulse 2s ease-in-out';
        licenseSection.scrollIntoView({ behavior: 'smooth' });
        
        // Adicionar temporariamente uma classe para chamar atenção
        licenseSection.classList.add('license-highlight');
        setTimeout(() => {
          licenseSection.classList.remove('license-highlight');
        }, 3000);
      }
    }
  }
  
  /**
   * Exibe uma caixa de confirmação e exclui o script se confirmado
   * @param {number} scriptId ID do script a ser excluído
   */
  function deleteScriptWithConfirmation(scriptId) {
    const script = scripts.find(s => s.id === scriptId);
    if (!script) return;
    
    if (confirm(`Deseja realmente excluir o script "${script.name}"?\nEsta ação também removerá a injeção do script em qualquer site onde esteja ativo.`)) {
      // Primeiro remover a injeção do script, se estiver ativa
      removeInjection(script);
      
      // Depois excluir o script do armazenamento
      StorageModule.deleteScript(scriptId)
        .then(success => {
          if (success) {
            // Atualizar a lista local de scripts
            scripts = scripts.filter(s => s.id !== scriptId);
            
            // Se o script excluído era o selecionado, limpar o painel de detalhes
            if (selectedScriptId === scriptId) {
              selectedScriptId = null;
              document.getElementById('no-selection-message').classList.remove('hidden');
              document.getElementById('script-detail-content').classList.add('hidden');
            }
            
            // Atualizar a interface
            renderScriptLists();
            
            // Selecionar outro script, se houver
            if (scripts.length > 0 && selectedScriptId === null) {
              selectScript(scripts[0].id);
            }
            
            showToast(`Script "${script.name}" excluído com sucesso`);
          } else {
            showToast('Erro ao excluir script', 'error');
          }
        })
        .catch(error => {
          console.error('Erro ao excluir script:', error);
          showToast('Erro ao excluir script', 'error');
        });
    }
  }
  
  // API pública do módulo
  /**
   * Exporta todos os scripts como um arquivo JSON
   */
  async function exportScriptsToFile() {
    try {
      if (!hasValidLicense) {
        showLicenseErrorMessage();
        return;
      }
      
      const backup = await StorageModule.exportScripts();
      
      // Converter para string JSON
      const backupJson = JSON.stringify(backup, null, 2);
      
      // Criar um blob com os dados
      const blob = new Blob([backupJson], { type: 'application/json' });
      
      // Criar URL temporária para o blob
      const url = URL.createObjectURL(blob);
      
      // Criar link de download
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspectmaker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      
      // Adicionar ao DOM, clicar e remover
      document.body.appendChild(a);
      a.click();
      
      // Limpeza
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      showToast('Backup exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao exportar scripts:', error);
      showToast(`Erro ao exportar scripts: ${error.message}`, 'error');
    }
  }
  
  /**
   * Abre um arquivo de backup e importa os scripts
   */
  function importScriptsFromFile() {
    try {
      if (!hasValidLicense) {
        showLicenseErrorMessage();
        return;
      }
      
      // Criar um input de arquivo invisível
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      
      fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
          const reader = new FileReader();
          
          reader.onload = async (e) => {
            try {
              const backupData = JSON.parse(e.target.result);
              
              // Mostrar diálogo de confirmação com opções
              const importSettings = confirm('Deseja importar também as configurações?');
              const replaceExisting = confirm('Deseja substituir todos os scripts existentes? (Cancelar irá apenas adicionar novos scripts ou atualizar existentes)');
              
              const options = {
                importSettings,
                replaceExisting,
                mergeScripts: !replaceExisting
              };
              
              const result = await StorageModule.importScripts(backupData, options);
              
              // Recarregar scripts após importação
              await loadScripts();
              renderScriptLists();
              
              let message = `Importação concluída. ${result.scriptsImported} scripts importados.`;
              if (result.settingsImported) {
                message += ' Configurações atualizadas.';
                // Recarregar a página para aplicar novas configurações
                alert('A página será recarregada para aplicar as novas configurações.');
                location.reload();
              }
              
              showToast(message, 'success');
            } catch (error) {
              console.error('Erro ao processar o arquivo de backup:', error);
              showToast(`Erro ao processar o arquivo: ${error.message}`, 'error');
            }
          };
          
          reader.readAsText(file);
        } catch (error) {
          console.error('Erro ao ler o arquivo:', error);
          showToast(`Erro ao ler o arquivo: ${error.message}`, 'error');
        }
      });
      
      // Dispara o seletor de arquivos
      fileInput.click();
    } catch (error) {
      console.error('Erro ao importar scripts:', error);
      showToast(`Erro ao importar scripts: ${error.message}`, 'error');
    }
  }

  return {
    init,
    createNewScript,
    saveScript,
    runScript,
    injectScript,
    removeInjection,
    showToast,
    exportScriptsToFile,
    importScriptsFromFile,
    deleteScriptWithConfirmation
  };
})();