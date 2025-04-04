# InspectMaker

InspectMaker é uma extensão poderosa para criar, gerenciar e executar scripts JavaScript personalizados em páginas web, com funcionalidades avançadas e múltiplos modos de injeção.

## Características

- **Múltiplos modos de injeção**:
  - Instantâneo: executa imediatamente ao carregar a página
  - Atrasado: executa após um atraso definido
  - Baseado em evento: executa quando um evento específico ocorre
  - Sob demanda: executa manualmente quando necessário
  - Persistente: executa repetidamente em intervalos regulares

- **Ambientes de execução variados**:
  - Navegador: executa no contexto da página web
  - PC: executa no Node.js local
  - Navegador com Helper PC: executa no navegador com suporte do Node.js local

- **Editor de código avançado**:
  - Syntax highlighting
  - Auto-complete
  - Temas personalizáveis
  - Numeração de linhas

- **Gerenciamento de scripts**:
  - Organização por status (ativo/inativo)
  - Configurações personalizadas por script
  - Logs de execução detalhados

- **Segurança**:
  - Execução de scripts em sandboxes isoladas
  - Controle de permissões
  - Lista de domínios permitidos

## Instalação

### Para uso normal

1. Baixe a versão mais recente da extensão na Chrome Web Store ou Mozilla Add-ons
2. Instale a extensão no seu navegador
3. Acesse através do ícone da extensão na barra de ferramentas

### Para desenvolvedores (instalação manual)

1. Clone este repositório: `git clone https://github.com/username/inspectmaker.git`
2. Acesse chrome://extensions/ no navegador Chrome
3. Ative o "Modo de desenvolvedor"
4. Clique em "Carregar sem compactação" e selecione a pasta "inspectmaker-extension"

### Servidor Helper PC (Opcional)

Para usar a funcionalidade de execução de scripts no ambiente PC:

1. Instale o Node.js (versão 14 ou superior)
2. Navegue até a pasta do servidor: `cd inspectmaker-extension`
3. Instale as dependências: `npm install vm2`
4. Inicie o servidor: `node server.js`
5. Ative o "Usar servidor helper local" nas configurações da extensão

## Uso

1. Clique no ícone da InspectMaker na barra de ferramentas
2. Crie um novo script com o botão "Novo Script"
3. Escreva seu código JavaScript no editor
4. Configure as opções de execução conforme necessário
5. Salve o script
6. Navegue até uma página web compatível
7. O script será executado de acordo com seu modo de injeção

## Exemplos de Uso

### Alterações visuais
```javascript
// Mudar a cor de fundo de todos os parágrafos para azul claro
document.querySelectorAll('p').forEach(p => {
  p.style.backgroundColor = '#e6f7ff';
});
```

### Automação de tarefas
```javascript
// Clicar automaticamente em um botão após 5 segundos
setTimeout(() => {
  const button = document.querySelector('#submit-button');
  if (button) button.click();
}, 5000);
```

### Extração de dados
```javascript
// Extrair todos os links de uma página
const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
console.log(links);
```

## Licença

Este projeto é licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.