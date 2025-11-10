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
  ]
};

// module.exports = {
//   presets: [
//     ['@babel/preset-env', { targets: { node: 'current' } }],
//     ['@babel/preset-react', { runtime: 'automatic' }]
//   ]
// };
