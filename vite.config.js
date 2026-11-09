import {defineConfig} from 'vite';
export default defineConfig({server:{watch:{ignored:['**/.project-state/**']}},build:{target:'es2022'}});
