let animationFinished = false;
let catalogsLoaded = false;

// Comprobar si ambos eventos (carga de datos y fin de animación) ocurrieron para ocultar el Splash Screen
function checkCloseSplash() {
    if (animationFinished && catalogsLoaded) {
        const splash = document.getElementById('splash-overlay');
        if (splash) {
            splash.classList.add('hidden');
        }
    }
}

// Abrir el visor modal integrado con el catálogo embebido de Google Drive (Premium UX/UI)
function openCatalogModal(name, url) {
    const driveRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(driveRegex);
    
    if (match) {
        const fileId = match[1];
        const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        
        const modal = document.getElementById('catalog-modal');
        const iframe = document.getElementById('catalog-iframe');
        const title = document.getElementById('modal-catalog-title');
        const loader = document.getElementById('modal-loader');
        const externalLink = document.getElementById('modal-external-link');
        
        if (modal && iframe && title && loader && externalLink) {
            title.textContent = `Catálogo ${name}`;
            externalLink.href = url;
            
            // Mostrar estado de carga e iniciar renderizado del iframe
            loader.style.display = 'flex';
            iframe.classList.remove('loaded');
            iframe.src = previewUrl;
            
            // Ocultar spinner cuando el contenido del PDF se cargue
            iframe.onload = () => {
                loader.style.display = 'none';
                iframe.classList.add('loaded');
            };
            
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
        }
    } else {
        // Respaldo para URLs no compatibles con Drive (se abren en nueva pestaña)
        window.open(url, '_blank');
    }
}

async function loadCatalogs() {
    try {
        // Conexión con el puente inteligente de Google Drive
        const scriptUrl = 'https://script.google.com/macros/s/AKfycbzExdds6b-GohChV2QznSANOvUf7G5XhKVUCkkZ2zaYc_clykdL4kGvrmdMgQ4Owzo/exec';
        const response = await fetch(scriptUrl);
        if (!response.ok) throw new Error('No se pudo conectar con Drive');
        const catalogs = await response.json();
        
        // Si hay un error en el script, usamos el respaldo
        if (catalogs.error) throw new Error(catalogs.error);
        
        // Agregamos los botones fijos que siempre deben aparecer
        agregarBotonesEspeciales(catalogs);
        renderCatalogs(catalogs);
    } catch (error) {
        console.warn('Cargando datos de respaldo (Modo Local):', error);
        // Lista completa de todas las marcas
        const backupData = [
            { name: "ARBELL", url: "#", status: "Ver Catálogo" },
            { name: "AVON", url: "https://drive.google.com/file/d/1HvDEJJzIaKJaZbaH9uDbfJuRqtFy4GGj/view", status: "Campaña Actual" },
            { name: "GIGOT", url: "https://online.fliphtml5.com/aups/qzsa/#p=1", status: "Campaña 8" },
            { name: "MILLANEL", url: "https://issuu.com/millanelcosmetica/docs/c5-2026", status: "Campaña 5" },
            { name: "ALL BEAUTY", url: "https://drive.google.com/file/d/1UCbOXyPNcU4Ujn6zoSP6PYO_muGlANIO/view", status: "Nuevo" },
            { name: "BAGUÉS", url: "https://drive.google.com/file/d/15sezHZUwV0jl2yCU92MqtMVf9EDwj1-r/view", status: "Disponible" },
            { name: "UNLOCK", url: "https://drive.google.com/file/d/1Hy5A0FPwFc6_FBd00HMG_kquHxYv4HG1/view", status: "Nuevo" },
            { name: "MONIQUE ARNOLD", url: "https://drive.google.com/file/d/16rGWOSuMgY1av8ofzJTokvg_-JSBZsPW/view", status: "Vigente" },
            { name: "NATURA", url: "https://drive.google.com/file/d/1XiASrrFH3czcg7GxKHcG-7cONpJdTpzw/view", status: "Ciclo Actual" },
            { name: "⭐ OFERTAS ESPECIALES", url: "ofertas.html", status: "Ver Ofertas" }
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
        // Mejorar la accesibilidad por teclado y lectores de pantalla (sin interferir visualmente)
        card.setAttribute('aria-label', `Ver catálogo de ${catalog.name} (${catalog.status})`);
        
        // Interceptar clics para abrir archivos de Google Drive en nuestro visor integrado
        card.addEventListener('click', (e) => {
            const driveRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
            if (catalog.url.match(driveRegex)) {
                e.preventDefault();
                openCatalogModal(catalog.name, catalog.url);
            }
        });
        
        card.innerHTML = `
            <div class="catalog-info">
                <span class="catalog-name">${catalog.name}</span>
                <span class="catalog-status">${catalog.status}</span>
            </div>
            <div class="catalog-arrow" aria-hidden="true">
                <i data-lucide="chevron-right"></i>
            </div>
        `;
        list.appendChild(card);
    });

    // Reinicializar iconos para los nuevos elementos
    lucide.createIcons();

    // Indicar que los catálogos ya están renderizados
    catalogsLoaded = true;
    checkCloseSplash();
}

// Botones que SIEMPRE aparecen, vengan o no de Drive
function agregarBotonesEspeciales(catalogs) {
    // Arbell: solo si no viene ya en la lista de Drive
    if (!catalogs.find(c => c.name.toUpperCase() === 'ARBELL')) {
        catalogs.unshift({ name: "ARBELL", url: "#", status: "Ver Catálogo" });
    }
    // Ofertas Especiales: siempre al final
    if (!catalogs.find(c => c.name.toUpperCase().includes('OFERTA'))) {
        catalogs.push({ name: "⭐ OFERTAS ESPECIALES", url: "ofertas.html", status: "Ver Ofertas" });
    }
}

// Carga inicial
document.addEventListener('DOMContentLoaded', () => {
    // 1. Escuchar la finalización de la animación de la barra de estado
    const loaderBar = document.querySelector('.loader-bar');
    if (loaderBar) {
        loaderBar.addEventListener('animationend', () => {
            animationFinished = true;
            checkCloseSplash();
        });
        
        // Respaldo secundario si animationend falla por inactividad de pestaña
        setTimeout(() => {
            animationFinished = true;
            checkCloseSplash();
        }, 2200); // 2s de la animación de la barra + 200ms de gracia
    } else {
        animationFinished = true;
    }

    // 2. Configurar cierre del modal
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modal = document.getElementById('catalog-modal');
    const iframe = document.getElementById('catalog-iframe');
    
    if (closeModalBtn && modal && iframe) {
        const closeModal = () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            iframe.src = ''; // Limpiar src para liberar memoria y detener carga
            iframe.classList.remove('loaded');
            document.body.classList.remove('modal-open');
        };
        
        closeModalBtn.addEventListener('click', closeModal);
        
        // Cerrar con tecla Escape para accesibilidad
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
        });
    }

    // 3. Cargar catálogos
    loadCatalogs();

    // 4. Timeout de seguridad general por problemas de red lentos (evita bloqueo total)
    setTimeout(() => {
        const splash = document.getElementById('splash-overlay');
        if (splash && !splash.classList.contains('hidden')) {
            console.warn('Splash Screen cerrado por timeout de seguridad (6s)');
            splash.classList.add('hidden');
        }
    }, 6000);
});
