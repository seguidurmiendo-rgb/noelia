const https = require('https');
const fs = require('fs');

const SOURCE_URL = 'https://linkbio.co/70626033NT5YG';
const OUTPUT_FILE = 'catalogs.json';

console.log('🤖 Iniciando sincronización de catálogos...');

https.get(SOURCE_URL, (res) => {
    let html = '';
    res.on('data', (chunk) => html += chunk);
    res.on('end', () => {
        try {
            // Buscamos los links en el HTML. Linkbio suele tenerlos en un objeto JSON dentro de un script.
            // O podemos usar una expresión regular para capturar los botones y sus links.
            const links = [];
            
            // Expresión regular para encontrar los enlaces de Google Drive en los botones
            const driveRegex = /https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/view[?usp=drivesdk]*/g;
            const allDriveLinks = html.match(driveRegex) || [];
            
            // Para los nombres, buscamos patrones comunes de botones
            // Nota: Esta es una versión simplificada. En un entorno real, Linkbio es dinámico,
            // pero podemos capturar los links principales.
            
            // Mapeo manual de nombres basado en el orden encontrado (o detección por texto)
            const names = ["AVON", "CASA & ESTILO", "ALL BEAUTY", "BAGUÉS", "UNLOCK", "MONIQUE ARNOLD", "NATURA"];
            
            const uniqueLinks = [...new Set(allDriveLinks)];
            
            const updatedData = uniqueLinks.map((link, index) => ({
                name: names[index] || `Catálogo ${index + 1}`,
                url: link,
                status: "Actualizado"
            }));

            if (updatedData.length > 0) {
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedData, null, 4));
                console.log(`✅ ¡Éxito! Se actualizaron ${updatedData.length} catálogos.`);
            } else {
                console.log('⚠️ No se encontraron links nuevos. Verificando estructura...');
            }

        } catch (error) {
            console.error('❌ Error al procesar el HTML:', error);
        }
    });
}).on('error', (err) => {
    console.error('❌ Error de red:', err.message);
});
