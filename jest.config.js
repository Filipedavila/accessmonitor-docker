module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true, 
          },
          baseUrl: '.',
          paths: {
            'src/*': ['./src/*'],
    
          }
        },
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!uuid)/'
  ],collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  
  coveragePathIgnorePatterns: [
    'node_modules',
    'dist',
    'coverage',
    'src/main.ts',
    'src/amp/amp.swagger.ts',
    'src/util/mapping.ts', 
    'test/'
  ],
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!main.(t|j)s',
    '!**/*.module.(t|j)s',
    '!**/*.dto.(t|j)s',
    '!**/*.entity.(t|j)s',
    '!**/*.args.(t|j)s',
    '!**/*.types.(t|j)s',
    '!**/node_modules/**',
  ],
  coverageDirectory: '../coverage',
  
  testEnvironment: 'node',
  moduleNameMapper: {
    '^test/(.*)$': '<rootDir>/test/$1',
    '^src/(.*)$': '<rootDir>/src/$1', 
  },
};