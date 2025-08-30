#!/usr/bin/env node

/**
 * Script para gerar ícones PWA em diferentes tamanhos
 * Requer: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Função para criar ícone SVG
function createSVGIcon(size, isMaskable = false) {
  const padding = isMaskable ? size * 0.1 : 0; // 10% padding para maskable
  const innerSize = size - (padding * 2);
  const radius = isMaskable ? size * 0.1 : size * 0.167; // Border radius
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#271F30" rx="${radius}"/>
  <g transform="translate(${padding}, ${padding})">
    <circle cx="${innerSize/2}" cy="${innerSize/2}" r="${innerSize * 0.31}" fill="none" stroke="#EFEAE3" stroke-width="${Math.max(4, innerSize * 0.04)}"/>
    <circle cx="${innerSize/2}" cy="${innerSize/2}" r="${innerSize * 0.06}" fill="#EFEAE3"/>
    <text x="${innerSize/2}" y="${innerSize * 0.78}" text-anchor="middle" fill="#EFEAE3" font-family="Arial, sans-serif" font-size="${innerSize * 0.1}" font-weight="bold">Radio</text>
    <text x="${innerSize/2}" y="${innerSize * 0.89}" text-anchor="middle" fill="#EFEAE3" font-family="Arial, sans-serif" font-size="${innerSize * 0.083}">Importante</text>
  </g>
</svg>`;
}

// Tamanhos necessários
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, 'public', 'icons');

// Criar diretório se não existir
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Gerar ícones normais
sizes.forEach(size => {
  const svg = createSVGIcon(size, false);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.svg`), svg);
  console.log(`✅ Criado icon-${size}x${size}.svg`);
});

// Gerar ícones maskable (apenas 192 e 512)
[192, 512].forEach(size => {
  const svg = createSVGIcon(size, true);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}-maskable.svg`), svg);
  console.log(`✅ Criado icon-${size}x${size}-maskable.svg`);
});

// Criar favicon
const faviconSvg = createSVGIcon(32, false);
fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), faviconSvg);
console.log(`✅ Criado favicon.svg`);

console.log('\n🎯 Ícones SVG gerados com sucesso!');
console.log('📝 Para converter para PNG, instale sharp: npm install sharp');
console.log('💡 Os ícones SVG funcionam perfeitamente como PWA icons');
