// babel.config.cjs

module.exports = {
  presets: [
    ['@babel/preset-env', { 
      targets: { node: 'current' },
      modules: 'commonjs'  // Convert ES modules to CommonJS for Jest
    }],
    ['@babel/preset-react', { 
      runtime: 'automatic' 
    }]
  ],
  plugins: [
    function() {
      return {
        visitor: {
          MemberExpression(path) {
            // Transform import.meta.env.VITE_OPENAI_API_KEY to process.env.VITE_OPENAI_API_KEY
            if (path.node.object && 
                path.node.object.type === 'MetaProperty' &&
                path.node.object.meta && path.node.object.meta.name === 'import' &&
                path.node.object.property && path.node.object.property.name === 'meta') {
              if (path.node.property && path.node.property.name === 'env') {
                // Replace import.meta.env with process.env
                path.replaceWithSourceString('process.env');
              }
            }
            // Handle import.meta.env.VITE_OPENAI_API_KEY
            if (path.node.object && 
                path.node.object.type === 'MemberExpression' &&
                path.node.object.object &&
                path.node.object.object.type === 'MetaProperty' &&
                path.node.object.object.meta && path.node.object.object.meta.name === 'import' &&
                path.node.object.object.property && path.node.object.object.property.name === 'meta' &&
                path.node.object.property && path.node.object.property.name === 'env') {
              const propName = path.node.property.name;
              path.replaceWithSourceString(`process.env.${propName}`);
            }
          }
        }
      };
    }
  ]
};

// module.exports = {
//   presets: [
//     ['@babel/preset-env', { targets: { node: 'current' } }],
//     ['@babel/preset-react', { runtime: 'automatic' }]
//   ]
// };

