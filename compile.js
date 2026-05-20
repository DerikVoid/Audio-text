const fs = require('fs');
const path = require('path');

function compile() {
    try {
        console.log('Iniciando compilação do aplicativo Web...');
        
        const rootDir = __dirname;
        const htmlPath = path.join(rootDir, 'index.html');
        const cssPath = path.join(rootDir, 'style.css');
        const jsPath = path.join(rootDir, 'script.js');
        const outputPath = path.join(rootDir, 'src', 'htmlContent.js');

        if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
            console.error('Erro: Arquivos index.html, style.css ou script.js não encontrados na raiz!');
            process.exit(1);
        }

        let html = fs.readFileSync(htmlPath, 'utf8');
        const css = fs.readFileSync(cssPath, 'utf8');
        const js = fs.readFileSync(jsPath, 'utf8');

        // Substitui a chamada do CSS externo pelo conteúdo embutido
        const styleTag = `<style>\n${css}\n</style>`;
        html = html.replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, styleTag);

        // Substitui a chamada do JS externo pelo conteúdo embutido
        const scriptTag = `<script>\n${js}\n</script>`;
        html = html.replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, scriptTag);

        // Garante que o diretório src existe
        const srcDir = path.join(rootDir, 'src');
        if (!fs.existsSync(srcDir)) {
            fs.mkdirSync(srcDir);
        }

        // Exporta como uma constante JS stringificada para evitar problemas de escape de template strings
        const fileContent = `// Arquivo gerado automaticamente pelo compile.js. Não edite este arquivo diretamente.\nexport const htmlContent = ${JSON.stringify(html)};\n`;
        
        fs.writeFileSync(outputPath, fileContent, 'utf8');
        console.log(`Sucesso: Aplicativo compilado e salvo em ${outputPath}`);
    } catch (error) {
        console.error('Erro durante a compilação:', error);
        process.exit(1);
    }
}

compile();
