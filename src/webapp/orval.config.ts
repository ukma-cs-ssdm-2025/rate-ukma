import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    output: {
      mode: 'split',
      target: 'ts-swc',
      client: 'react-query',
      override: {
        operations: {
          courses_list: {
            query: {
              useInfinite: true,
            },
          },
          course_ratings_list: {
            query: {
              useInfinite: true,
            },
          },
        },
      },
      schemas: 'src/lib/api-generated/models',
      mock: false,
      workspace: 'src/lib/api-generated',
    },
    input: {
      target: '../../docs/api/openapi-generated.yaml',
    },
    hooks: {
      afterAllFilesWrite: 'biome format --write src/lib/api-generated/**/*.{ts,tsx}',
    },
  },
});
