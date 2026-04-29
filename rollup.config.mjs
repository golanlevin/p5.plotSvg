export default [
  {
    input: 'src/browser.js',
    output: {
      file: 'dist/p5.plotSvg.js',
      format: 'iife'
    }
  },
  {
    input: 'src/main.js',
    output: {
      file: 'dist/p5.plotSvg.esm.js',
      format: 'esm'
    }
  }
];
