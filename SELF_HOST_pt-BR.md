# deco.chat: Arquitetura e Self-Hosting

## Visão Geral da Arquitetura

O deco.chat é uma plataforma de criação de agentes de IA construída sobre uma
arquitetura moderna baseada em **Cloudflare Workers**. Esta escolha tecnológica
oferece vantagens significativas em termos de performance, escalabilidade e
facilidade de deployment.

### Tecnologias Principais

- **TypeScript**: Linguagem base para todo o desenvolvimento
- **Cloudflare Workers**: Runtime baseado em Web Standards
- **React 19**: Interface do usuário moderna
- **Deno**: Gerenciamento de dependências e ferramentas de desenvolvimento
- **Vite**: Build system otimizado

## Arquitetura de Workers

O deco.chat utiliza o **workerd**, o runtime open source que alimenta o
Cloudflare Workers. Como descrito pela própria Cloudflare, o workerd é
"projetado especificamente para servidores" e oferece **APIs Web padrão** sempre
que possível, incluindo Fetch, URL, WebCrypto e outras APIs encontradas em
navegadores web.

Esta abordagem baseada em padrões web significa que o código desenvolvido no
deco.chat é naturalmente portável e pode ser executado em diversos ambientes
compatíveis com os padrões web.

### Vantagens da Arquitetura Workers

1. **Inicialização Instantânea**: Workers iniciam em milissegundos, não segundos
2. **Escalabilidade Automática**: Escala de zero para milhões de requisições
   instantaneamente
3. **Distribuição Global**: Executa próximo aos usuários finais
4. **Isolamento Seguro**: Cada Worker roda em um isolate V8 separado
5. **Compatibilidade Web**: Usa APIs padrão da web, facilitando desenvolvimento
   e portabilidade

## Estrutura do Projeto

```
deco.chat/
├── apps/
│   ├── api/          # API backend (Cloudflare Worker)
│   ├── outbound/     # Serviços de comunicação externa
│   └── web/          # Interface web (React SPA)
├── packages/
│   ├── ai/           # Lógica de IA e agentes
│   ├── sdk/          # SDK para desenvolvimento
│   └── ui/           # Componentes de interface
```

## Opções de Self-Hosting

### Recomendação: Cloudflare

**Recomendamos fortemente o hosting na Cloudflare** pelos seguintes motivos:

- **CDN Integrada**: Cloudflare é uma CDN de classe mundial
- **Ambiente Nativo**: O deco.chat foi projetado para o ecossistema Cloudflare
- **Configuração Simplificada**: Deploy direto sem configurações complexas
- **Performance Otimizada**: Execução no mesmo ambiente usado em produção

### Alternativas de Self-Hosting

Graças ao uso de **Web Standards**, o deco.chat pode ser executado em qualquer
ambiente compatível com workerd:

#### 1. workerd Open Source

```bash
# Instalação local do workerd
npm install workerd
```

#### 2. Ambientes Compatíveis

- **Deno Deploy**: Suporte nativo a Web Standards
- **Vercel Edge Runtime**: Compatível com Workers API
- **Netlify Edge Functions**: Ambiente similar baseado em Deno

#### 3. Self-Hosting Tradicional

Para ambientes corporativos que requerem hosting interno, é possível:

- Executar workerd em containers Docker
- Deploy em Kubernetes usando imagens workerd
- Configuração em VMs dedicadas

## Facilidade de Deployment

A arquitetura baseada em Workers oferece deployment extremamente simples:

```bash
# Deploy para Cloudflare
npm run deploy

# Build local para testes
npm run build
```

### Vantagens do Deployment

1. **Zero Configuração de Servidor**: Não há servidores para gerenciar
2. **Escalabilidade Automática**: Sem necessidade de configurar load balancers
3. **Atualizações Instantâneas**: Deploy global em segundos
4. **Rollback Simples**: Reversão imediata em caso de problemas

## Apps Deco: Implementação de MCPs

As **Apps Deco** são aplicações especializadas que implementam o **Model Context
Protocol (MCP)**, permitindo que agentes de IA se conectem e interajam com APIs
externas e fontes de dados do cliente de forma padronizada.

### O que são MCPs

MCPs (Model Context Protocols) são protocolos padronizados que definem como
agentes de IA devem se comunicar com serviços externos. Cada MCP expõe um
conjunto de **tools** (ferramentas) tipadas que podem ser chamadas pelos
agentes.

### Funcionalidades das Apps Deco

As Apps Deco oferecem três capacidades principais:

1. **Tools**: Funções que agentes podem chamar para executar ações
2. **Workflows**: Sequências de passos automatizados que podem ser executados
3. **Views**: Componentes de interface que podem ser renderizados no chat

### Estrutura de uma App Deco

```typescript
// main.ts - Estrutura básica de uma App Deco
import { withRuntime } from "@deco/workers-runtime";
import {
  createStepFromTool,
  createTool,
  createWorkflow,
} from "@deco/workers-runtime/mastra";
import { z } from "zod/v3";

// Definição de uma ferramenta (Tool)
const createMyTool = (_bindings: Bindings) =>
  createTool({
    id: "MY_TOOL",
    description: "Executa uma ação específica",
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ message: z.string() }),
    execute: async ({ context }) => ({
      message: `Processado: ${context.name}`,
    }),
  });

// Definição de um workflow
const createMyWorkflow = (bindings: Bindings) => {
  const step = createStepFromTool(createMyTool(bindings));

  return createWorkflow({
    id: "MY_WORKFLOW",
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ message: z.string() }),
  })
    .then(step)
    .commit();
};

// Exportação do runtime
const { Workflow, ...runtime } = withRuntime<Bindings>({
  workflows: [createMyWorkflow],
  tools: [createMyTool],
});

export { Workflow };
export default runtime;
```

### Integração com APIs Externas

As Apps Deco podem se conectar a qualquer API externa, permitindo que agentes:

- **Consultem bancos de dados** do cliente
- **Interajam com CRMs** como Salesforce
- **Acessem sistemas internos** via APIs REST
- **Processem documentos** e arquivos
- **Executem workflows** automatizados

### Deployment e Configuração

```bash
# Configurar workspace
deco configure

# Desenvolver localmente
deco dev

# Deploy para produção
deco deploy
```

### Exemplo de Integração com API

```typescript
const createDatabaseTool = (bindings: Bindings) =>
  createTool({
    id: "QUERY_DATABASE",
    description: "Consulta o banco de dados do cliente",
    inputSchema: z.object({
      query: z.string(),
      params: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({
      results: z.array(z.record(z.unknown())),
    }),
    execute: async ({ context }) => {
      const response = await fetch(bindings.DATABASE_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${bindings.DATABASE_TOKEN}` },
        body: JSON.stringify({
          query: context.query,
          params: context.params,
        }),
      });

      const data = await response.json();
      return { results: data };
    },
  });
```

## Segurança e Isolamento

O deco.chat herda os benefícios de segurança do Cloudflare Workers:

- **Isolamento V8**: Cada aplicação roda em um isolate separado
- **Capability Bindings**: Acesso controlado a recursos externos
- **Sem Acesso ao Sistema**: Sandbox seguro por design
- **Atualizações Automáticas**: Patches de segurança aplicados automaticamente

## Suporte Técnico

Para implementação e suporte técnico especializado, nossa equipe está disponível
para auxiliar em:

- **Configuração de Self-Hosting**: Setup personalizado para ambiente
  corporativo
- **Migração de Dados**: Transferência segura de dados existentes
- **Customizações**: Desenvolvimento de funcionalidades específicas
- **Treinamento**: Capacitação da equipe técnica

**Contato**: suporte@deco.cx

## Compatibilidade com Padrões Web

Como mencionado no blog da Cloudflare sobre workerd, o runtime "oferece as
mesmas APIs padrão encontradas em navegadores web"
([Introducing workerd: the Open Source Workers runtime](https://blog.cloudflare.com/workerd-open-source-workers-runtime/#web-standard-apis)).
Isso significa que o código desenvolvido no deco.chat é altamente portável e
segue padrões estabelecidos da indústria.

Esta compatibilidade garante que aplicações desenvolvidas no deco.chat podem ser
facilmente adaptadas para outros ambientes que suportam Web Standards,
oferecendo flexibilidade máxima para organizações que precisam de opções de
deployment variadas.

Para dúvidas técnicas ou suporte adicional, abra uma
[issue no repositório](https://github.com/deco-cx/chat/issues).
