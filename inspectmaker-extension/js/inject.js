/**
 * Script de injeção
 * Este arquivo é injetado diretamente nas páginas web para executar scripts
 */

(function() {
  // Este script é executado no contexto da página
  
  // Receber e executar scripts do InspectMaker
  window.addEventListener('message', function(event) {
    // Verificar origem da mensagem
    if (event.source !== window || !event.data || !event.data.action) {
      return;
    }
    
    // Processar apenas mensagens do InspectMaker
    if (event.data.action === 'inspectmaker-execute') {
      try {
        // Extrair código do script
        const code = event.data.code;
        
        // Executar o código em função isolada
        const result = (new Function(code))();
        
        // Enviar resultado de volta para o content script
        window.postMessage({
          action: 'inspectmaker-result',
          scriptId: event.data.scriptId,
          success: true,
          result: result !== undefined ? String(result) : undefined
        }, '*');
      } catch (error) {
        // Enviar erro de volta para o content script
        window.postMessage({
          action: 'inspectmaker-result',
          scriptId: event.data.scriptId,
          success: false,
          error: error.message
        }, '*');
        
        // Registrar erro no console
        console.error('[InspectMaker] Erro ao executar script:', error);
      }
    }
  });
  
  // Notificar que o script de injeção foi carregado
  window.postMessage({ action: 'inspectmaker-injected' }, '*');
})();