import { School, InventoryItem, MenuItem } from './types';

// Using the direct image links found in the HTML design
export const IMAGES = {
  loginBg: "https://lh3.googleusercontent.com/aida-public/AB6AXuBUFM8yJdk0ZZA4mc4xFeFc9NYfZNiyqOmAf3qJezbuDYM_RuhhSnE4x6gyEyNHKBsIe01xjULWFol8QAbZ7Ey4mrkMbNldT7ZMbhgjYeo3-tynoOx_KQxcN1N-N2nGY-gSZtQt8xV-JiG1Ny5IlIN5e5QN5jTeonorpnn_BWahRGcEiVT_RKQvshoiq-A9lfvTqeA8dvQFsLaaSM7Y_ofM_dAGoi_UavpfW7BVWsIjXdCz2GbmtPnFO3Gny1OR8eeimjfdUlVSmK1n",
  food1: "https://lh3.googleusercontent.com/aida-public/AB6AXuASfXqz3aDMawWaLs-gj6ihwAxQqRxha1kf5j81h0H6L6fs568cinr-XVhfPwMyyS-mbQ0df8Ky5RI6T5GzJAUq3QO32iryMBvNSOB0eNGF_v9Id2UWlcSvssJrtBJYMXueHdZJjuyK4DgLY9BbiVwvyWGrtm60B3evA3E79j4FSnLjRAlFKMYJXVqyO44inW8VnAW-uNB-HtRbJKisr-H5aWDV4TLSbFxFaYmE6Nmr6NgnRldsgw6fHpkiznjj3t9RY49QuF3XaDEs",
  food2: "https://lh3.googleusercontent.com/aida-public/AB6AXuDE6xbzfCIa-3tXAS0IQ0zfyxOlLKmaTyqiDewImnd5SMQK9yVISZW6sw90eowSmcw5l2J73h6YrMKU3L0LT_g0-rf-O4V4iBREWEKsQ--IajZ_M1bEh5Ydwqt8PS-Ammygpsxu8mXVXO799Ruh-P_UrNUczJbP9b-6X6sX4WLb4bkw3H4fWZlk6eOmv7brVb5fFaiF7P6rGNtYtoE1SxUPcoYyM-F-cQ4fR8PCOYvPZL5Xca4hVFN0_f7jpcQ45d6KFAIGh97pZ7Cx",
  food3: "https://lh3.googleusercontent.com/aida-public/AB6AXuAlk_4II2BnE3Pyita8fCjudLim3WUwOcDx64RIa0EDfAh_OgVnGXJCCevfNmMTv_intu2GTY5f_TxUuf-1vyFPS0GkljciAqMJswx1yxRitIRjmpZSXpPHaypjg5b99Cq0DGgC6tHTjDAwgXSIVvKil2ICvUth13eVTk0WG_diQGYlKCTjU-8Rl9ny7XPHRJYmShalqLRvAlY9ubDUOtBZnM4cBpW9JfApvyzTIN9pmoAs2ocBsfOnUa0htFfdCaEoWvkocjEALaTO",
  food4: "https://lh3.googleusercontent.com/aida-public/AB6AXuAhd7BqMNLI4SkSfyGKcOnSF4HEc3MNJTasRELtubZOy1E1Us_d_2_yHUgm9zu8evKs4t6dgWV4yNaqgXPQhcqDGoUgHhw50q7lqiaph7RuSWURYcb3tn-h-AFy_0YaD-tenp66guH_IsoReKeWsBVHIgcWzYpagyMaU5I6XziqgFiDkh3H1WD5o0tbjwcm0XBdZEpXcRd-7vO7_7ds9A7etouy3VIUwfXlztxcDdNYNdpkOqZnS3-JDQWqK-Z_a4NsF2UuPLvY_ViE",
  food5: "https://lh3.googleusercontent.com/aida-public/AB6AXuAEIsYlQjUKJfrhVQdJPl8sOCSEiSRw3FtgPBInybGqHJFjFZCtS46AM9Xp25llB5q6dv_O0aDH2SMiEcADgUXZ2cuq8v8r2FYaNqzi2QMAmtOP9Gr9cm6p11uOKnoVuTAUNnwTdOgJcbq45qy1bJCF0EFmSFsCIEj3ZzWrO1ORiw1im9GjgTrd0zWpKQlml7uA3mKtB_61h1nbBvCYol5HbOOOwLySiYCMvuvh0K45t-TZGSd7FgMKtfpKa_NdGNee2F2SfMEmzdXJ"
};

export const MOCK_SCHOOLS: School[] = [
  { id: '1', name: 'Escola Municipal João Cordeiro', location: 'Centro • Maceió', status: 'active' },
  { id: '2', name: 'Escola Municipal Dr. Domingos Correia', location: 'Serraria • Maceió', status: 'active' },
  { id: '3', name: 'Escola Municipal Profa. Maria Lúcia', location: 'Benedito Bentes • Maceió', status: 'pending' },
  { id: '4', name: 'Escola Municipal Santa Rosa', location: 'Tabuleiro • Maceió', status: 'active' },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Arroz Agulhinha', category: 'Grãos', unit: 'kg', quantity: 45, minQuantity: 50, status: 'critical' },
  { id: '2', name: 'Feijão Carioca', category: 'Grãos', unit: 'kg', quantity: 120, minQuantity: 40, status: 'adequate' },
  { id: '3', name: 'Ovos Brancos', category: 'Proteínas', unit: 'dz', quantity: 48, minQuantity: 20, status: 'adequate' },
  { id: '4', name: 'Óleo de Soja', category: 'Mercearia', unit: 'L', quantity: 12, minQuantity: 15, status: 'critical' },
];

export const PUBLIC_MENU: MenuItem[] = [
  { day: 'Segunda-feira', date: '03/02', lunch: 'Arroz, feijão, frango', snack: 'Banana e leite', image: IMAGES.food1 },
  { day: 'Terça-feira', date: '04/02', lunch: 'Macarrão com carne moída', snack: 'Maçã', image: IMAGES.food2 },
  { day: 'Quarta-feira', date: '05/02', lunch: 'Arroz, feijão, omelete', snack: 'Iogurte', image: IMAGES.food3 },
  { day: 'Quinta-feira', date: '06/02', lunch: 'Galinhada com legumes', snack: 'Melancia', image: IMAGES.food4 },
  { day: 'Sexta-feira', date: '07/02', lunch: 'Peixe assado, purê', snack: 'Biscoito e suco', image: IMAGES.food5 },
];
