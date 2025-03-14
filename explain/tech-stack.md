# Chat - Multi model chat app

This document provides an overview of the technical stack used in the Chat app, along with guidance for developing similar applications.

## Core Technologies

### Frontend Framework
- **React 18.2.0**: The application is built using React for its component-based architecture and robust ecosystem.
- **TypeScript**: The entire codebase uses TypeScript for type safety, improved developer experience, and better code maintainability.

### Build System
- **Vite 5.1.4**: Modern, fast build tool and development server with near-instant hot module replacement (HMR).
- **ESLint 9.21.0**: For code linting and enforcing consistent coding practices.

### UI Framework
- **Tailwind CSS**: The application is styled using Tailwind CSS for a clean and modern look.

### State Management
- **React Context API**: Used for global state management (see `HectorContext.tsx` and `LanguageContext.tsx`).
- **React Hooks**: Extensively used for component-level state management and side effects.

## Project Structure

```
hector/
├── src/
│   ├── components/       # React components organized by feature
│   │   ├── Home/         # Homepage components
│   │   ├── Layout/       # Layout components
│   │   ├── Runtime/      # App runtime components
│   │   └── ...
│   ├── context/          # React context providers
│   ├── services/         # Service modules for API integration
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Main application component
│   └── main.tsx          # Application entry point
├── explain/              # Documentation files
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite build configuration
```

## Key Design Patterns

1. **Context-based State Management**: The application uses React Context API for managing global state instead of state management libraries like Redux.

2. **Component Composition**: Components are organized in a hierarchical structure with clear separation of concerns.

3. **Dynamic Form Generation**: Forms are generated from JSON Schema definitions, allowing for flexible and maintainable form implementations.

4. **Localization Strategy**: The application uses a `Localizable<T>` type pattern that allows storing multi-language values for text fields.

5. **Mobile-First Design**: The UI is designed to work well on mobile devices first, with responsive adjustments for larger screens.

## Setting Up a Similar Project

### 1. Initialize a New Project

```bash
# Create a new Vite project with React and TypeScript
npm create vite@latest my-app -- --template react-ts

# Navigate to the project directory
cd my-app

# Install dependencies
npm install
```

### 2. Configure TypeScript

Create or update `tsconfig.json` with appropriate settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 3. Set Up Project Structure

Create the following directory structure:

```bash
mkdir -p src/components src/context src/services src/types
```

### 4. Implement Context Providers

Create context providers for global state management:

```tsx
// src/context/YourContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface YourContextType {
  // Define your context state and methods
}

const YourContext = createContext<YourContextType | null>(null);

export const YourProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Implement your state and methods
  
  return (
    <YourContext.Provider value={/* your context value */}>
      {children}
    </YourContext.Provider>
  );
};

export const useYourContext = () => {
  const context = useContext(YourContext);
  if (!context) {
    throw new Error('useYourContext must be used within a YourProvider');
  }
  return context;
};
```
### 5. Create Reusable Components

Build reusable components following the Hector project's pattern:

1. Define component props with TypeScript interfaces
2. Use functional components with hooks
3. Organize components by feature
4. Use Ant Design components as building blocks

## Best Practices

1. **Component Design**: Keep components focused on a single responsibility.
   
2. **Type Safety**: Use TypeScript interfaces and types consistently throughout the codebase.
   
3. **Form Handling**: Use React JSON Schema Form for complex, dynamic forms.
   
4. **Responsive Design**: Follow a mobile-first approach with responsive breakpoints.
   
5. **State Management**: Use React Context for global state and component state for local state.
   
6. **Code Organization**: Group related components and utilities together.
   
7. **Error Handling**: Implement consistent error handling patterns.

## Development Workflow

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Build for Production**:
   ```bash
   npm run build
   ```

3. **Lint Code**:
   ```bash
   npm run lint
   ```

4. **Preview Production Build**:
   ```bash
   npm run preview
   ```

## Conclusion

The Chat project demonstrates a well-structured React application with TypeScript, using modern patterns and libraries. By following the architecture and patterns outlined in this document, you can create similar applications with a focus on maintainability, type safety, and user experience.

For more detailed information on specific aspects of the implementation, refer to the other documentation files in the `explain/` directory. 

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
