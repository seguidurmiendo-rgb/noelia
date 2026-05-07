async function loadCatalogs() {
    try {
        // Conexión con el puente inteligente de Google Drive
        const scriptUrl = 'https://script.google.com/macros/s/AKfycbzExdds6b-GohChV2QznSANOvUf7G5XhKVUCkkZ2zaYc_clykdL4kGvrmdMgQ4Owzo/exec';
        const response = await fetch(scriptUrl);
        if (!response.ok) throw new Error('No se pudo conectar con Drive');
        const catalogs = await response.json();
        
        // Si hay un error en el script, usamos el respaldo
        if (catalogs.error) throw new Error(catalogs.error);
        
        renderCatalogs(catalogs);
    } catch (error) {
        console.warn('Cargando datos de respaldo (Modo Local):', error);
        // Lista completa de todas las marcas
        const backupData = [
            { name: "AVON", url: "https://drive.google.com/file/d/1HvDEJJzIaKJaZbaH9uDbfJuRqtFy4GGj/view", status: "Campaña Actual" },
            { name: "GIGOT", url: "https://online.fliphtml5.com/aups/qzsa/#p=1", status: "Campaña 8" },
            { name: "MILLANEL", url: "https://issuu.com/millanelcosmetica/docs/c5-2026", status: "Campaña 5" },
            { name: "ALL BEAUTY", url: "https://drive.google.com/file/d/1UCbOXyPNcU4Ujn6zoSP6PYO_muGlANIO/view", status: "Nuevo" },
            { name: "BAGUÉS", url: "https://drive.google.com/file/d/15sezHZUwV0jl2yCU92MqtMVf9EDwj1-r/view", status: "Disponible" },
            { name: "UNLOCK", url: "https://drive.google.com/file/d/1Hy5A0FPwFc6_FBd00HMG_kquHxYv4HG1/view", status: "Nuevo" },
            { name: "MONIQUE ARNOLD", url: "https://drive.google.com/file/d/16rGWOSuMgY1av8ofzJTokvg_-JSBZsPW/view", status: "Vigente" },
            { name: "NATURA", url: "https://drive.google.com/file/d/1XiASrrFH3czcg7GxKHcG-7cONpJdTpzw/view", status: "Ciclo Actual" }
        ];
        renderCatalogs(backupData);
    }
}

function renderCatalogs(catalogs) {
    const list = document.getElementById('catalog-list');
    list.innerHTML = ''; // Limpiar cargando

    catalogs.forEach(catalog => {
        const card = document.createElement('a');
        card.href = catalog.url;
        card.className = 'catalog-card';
        card.target = '_blank';
        
        card.innerHTML = `
            <div class="catalog-info">
                <span class="catalog-name">${catalog.name}</span>
                <span class="catalog-status">${catalog.status}</span>
            </div>
            <div class="catalog-arrow">
                <i data-lucide="chevron-right"></i>
            </div>
        `;
        list.appendChild(card);
    });

    // Reinicializar iconos para los nuevos elementos
    lucide.createIcons();

    // Ocultar pantalla de bienvenida con elegancia (esperamos a que termine la barra)
    setTimeout(() => {
        const splash = document.getElementById('splash-overlay');
        if (splash) splash.classList.add('hidden');
    }, 2200);
}

// Carga inicial
document.addEventListener('DOMContentLoaded', () => {
    loadCatalogs();
});
