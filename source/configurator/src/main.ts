import '@shoelace-style/shoelace/dist/themes/dark.css';
import './styles/theme.css';
import './styles/theme-iris-dark.css';
import './styles/global.css';
import './styles/utils.css';

import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
import { mount } from 'svelte';
import App from './App.svelte';

setBasePath('/node_modules/@shoelace-style/shoelace/dist');

const app = mount(App, { target: document.getElementById('app')! });

export default app;
