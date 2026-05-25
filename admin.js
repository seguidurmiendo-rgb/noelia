const API_URL = 'https://script.google.com/macros/s/AKfycbznkWrgiymjidOLTSMAcb67D9WWhJ28nStM_R_3gzWYbZxCe0G2YUPyFovIlt_HgjRf/exec';
const ADMIN_USER = 'noezrt';
const ADMIN_PASS = '18111973';

// Estado global de la app
let state = {
    clientes: [],
    articulos: [],
    pedidos: [],
    pagos: [],
    currentOrderItems: []
};

// ── Inicialización ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Forzar tema oscuro global en SweetAlert
    if (window.Swal) {
        window.Swal = window.Swal.mixin({
            background: '#111',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#333'
        });
    }
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('login-user').value;
        const p = document.getElementById('login-pass').value;
        if (u === ADMIN_USER && p === ADMIN_PASS) {
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('app-layout').classList.remove('hidden');
            initApp();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Acceso Denegado',
                text: 'Usuario o contraseña incorrectos',
                background: '#111',
                color: '#fff',
                confirmButtonColor: '#d4af37'
            });
        }
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        document.getElementById('app-layout').classList.add('hidden');
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('login-form').reset();
    });

    // Navegación Sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            showView(item.dataset.target);
        });
    });

    // Buscador en modal de artículos
    document.getElementById('buscador-articulos-modal').addEventListener('input', (e) => {
        renderModalArticulos(e.target.value);
    });

    // Buscador en modal de clientes
    document.getElementById('buscador-clientes-modal').addEventListener('input', (e) => {
        renderModalClientes(e.target.value);
    });

    // Inicializar Date Picker Moderno
    flatpickr("#pedido-fecha-entrega", {
        locale: "es",
        dateFormat: "Y-m-d",
        minDate: "today",
        disableMobile: "true"
    });
});

// Cargar datos iniciales
async function initApp() {
    await Promise.all([
        loadClientes(),
        loadArticulos(),
        loadPedidos()
    ]);
}

// ── Peticiones a Apps Script ───────────────────────
async function apiCall(action, payload = null) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    } catch (err) {
        console.error(err);
        Swal.fire('Error de conexión', err.message, 'error');
        return null;
    }
}

// ── Render de Tablas y Datos ──────────────────────
function renderTablePagos() {
    const tbody = document.querySelector('#tabla-cobranzas tbody');
    tbody.innerHTML = '';
    
    // Solo mostrar pedidos que no estén Cancelados
    const pedidosActivos = state.pedidos.filter(p => p.Estado !== 'Cancelado');
    
    pedidosActivos.forEach(p => {
        // Calcular total del pedido
        let totalVenta = 0;
        if(p.detalle) {
            p.detalle.forEach(d => totalVenta += (d.P_Venta * d.Cantidad));
        } else {
            totalVenta = p.Total_Venta || 0;
        }
        
        // Sumar pagos de este pedido
        const pagosPedido = state.pagos.filter(pago => pago.N_Pedido === p.N_Pedido);
        const totalAbonado = pagosPedido.reduce((acc, pago) => acc + (parseFloat(pago.Monto) || 0), 0);
        
        const saldo = totalVenta - totalAbonado;
        
        // Determinar estado de pago visual
        let estadoStr = '';
        if (saldo <= 0) estadoStr = '<span class="status-badge" style="background:#28a745">Pagado Total</span>';
        else if (totalAbonado > 0) estadoStr = '<span class="status-badge" style="background:#ffc107; color:black">Pago Parcial</span>';
        else estadoStr = '<span class="status-badge" style="background:#dc3545">Pendiente</span>';
        
        // Determinar nombre del cliente
        const clienteObj = state.clientes.find(c => String(c.ID) === String(p.Cliente_ID));
        const nombreCliente = clienteObj ? clienteObj.Nombre : p.Cliente_ID;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.N_Pedido}</strong></td>
            <td>${nombreCliente} <span style="color:var(--text-secondary); font-size: 0.8rem;">(${p.Cliente_ID})</span></td>
            <td style="font-weight:bold">$${totalVenta}</td>
            <td style="color:#4CAF50">$${totalAbonado}</td>
            <td style="color:var(--primary-color)">$${saldo < 0 ? 0 : saldo}</td>
            <td>${estadoStr}</td>
            <td style="display: flex; gap: 8px;">
                ${saldo > 0 ? `<button class="btn-secondary" style="padding: 4px 10px; font-size:0.8rem" onclick="abrirModalPago('${p.N_Pedido}', ${saldo})">Abonar</button>` : ''}
                ${totalAbonado > 0 ? `<button class="btn-icon" title="Ver Historial" onclick="verHistorialPagos('${p.N_Pedido}')" style="background: rgba(255,255,255,0.1); border-radius: 4px; padding: 4px;"><i data-lucide="list"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
    // Volver a renderizar los íconos de lucide que se acaban de inyectar dinámicamente
    if (window.lucide) {
        window.lucide.createIcons();
    }
    // Actualizar KPIs de la barra lateral
    updateSidebarStats();
}

function verHistorialPagos(nPedido) {
    document.getElementById('historial-pago-titulo').textContent = `(${nPedido})`;
    const tbody = document.querySelector('#tabla-historial-pagos tbody');
    tbody.innerHTML = '';
    
    const pagosPedido = state.pagos.filter(p => p.N_Pedido === nPedido);
    pagosPedido.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.Fecha}</td>
            <td style="color:#4CAF50; font-weight:bold">$${p.Monto}</td>
            <td>${p.Metodo}</td>
            <td>${p.Notas || '-'}</td>
            <td style="text-align:right">
                <button class="btn-icon" title="Eliminar Pago" onclick="eliminarPago('${p.N_Pedido}', '${p.Fecha}', ${p.Monto})" style="color: #dc3545; padding: 4px;"><i data-lucide="trash-2"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (window.lucide) window.lucide.createIcons();
    openModal('modal-ver-pagos');
}

// ── Carga de Datos y Tablas ────────────────────────
async function loadClientes() {
    document.getElementById('loading-clientes').classList.remove('hidden');
    const data = await apiCall('getClientes');
    if (data) {
        state.clientes = data;
        renderTablaClientes();
    }
    document.getElementById('loading-clientes').classList.add('hidden');
}

async function loadArticulos() {
    document.getElementById('loading-articulos').classList.remove('hidden');
    const data = await apiCall('getArticulos');
    if (data) {
        state.articulos = data;
        renderTablaArticulos();
    }
    document.getElementById('loading-articulos').classList.add('hidden');
}

async function loadPedidos() {
    document.getElementById('loading-pedidos').classList.remove('hidden');
    apiCall('getPedidos').then(res => {
        state.pedidos = res;
        return apiCall('getPagos');
    }).then(res => {
        state.pagos = res;
        document.getElementById('loading-pedidos').classList.add('hidden');
        renderTablaPedidos();
        renderTablePagos();
    });
}

// Renderizado de Tablas
let currentClientesRenderizados = [];

function renderTablaClientes(filtro = '') {
    const tbody = document.querySelector('#tabla-clientes tbody');
    tbody.innerHTML = '';
    
    currentClientesRenderizados = state.clientes.filter(c => {
        if (!filtro) return true;
        const text = `${c.ID} ${c.Nombre} ${c.Telefono}`.toLowerCase();
        return text.includes(filtro.toLowerCase());
    });
    
    currentClientesRenderizados.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${c.ID}</strong></td>
                <td>${c.Nombre}</td>
                <td>${c.Telefono}</td>
                <td>${c.Direccion}</td>
            </tr>`;
    });
    if (window.lucide) window.lucide.createIcons();
}

function filtrarClientes() {
    const filtro = document.getElementById('filtro-clientes').value;
    renderTablaClientes(filtro);
}

let currentArticulosRenderizados = [];

function renderTablaArticulos(filtro = '') {
    const tbody = document.querySelector('#tabla-articulos tbody');
    tbody.innerHTML = '';
    
    currentArticulosRenderizados = state.articulos.filter(a => {
        if (!filtro) return true;
        const text = `${a.Codigo} ${a.Marca} ${a.Descripcion}`.toLowerCase();
        return text.includes(filtro.toLowerCase());
    });
    
    currentArticulosRenderizados.forEach(a => {
        const pCompra = parseFloat(a.Precio_Compra) || 0;
        const pVenta = parseFloat(a.Precio_Venta) || 0;
        
        const rentBruta = pVenta - pCompra;
        let rentPorcentaje = 0;
        if (pCompra > 0) {
            rentPorcentaje = (rentBruta / pCompra) * 100;
        } else if (pVenta > 0) {
            rentPorcentaje = 100; // Si fue gratis y se vende, es 100% (simplificación)
        }
        
        // Colores según rentabilidad
        const colorRent = rentBruta > 0 ? '#4CAF50' : (rentBruta < 0 ? '#dc3545' : '#888');

        tbody.innerHTML += `
            <tr>
                <td><strong>${a.Codigo}</strong></td>
                <td><span class="badge">${a.Marca}</span></td>
                <td>${a.Descripcion}</td>
                <td>$${pCompra.toFixed(2)}</td>
                <td style="color:var(--primary-color)"><strong>$${pVenta.toFixed(2)}</strong></td>
                <td style="color:${colorRent}; font-weight:bold">$${rentBruta.toFixed(2)}</td>
                <td style="color:${colorRent}">${rentPorcentaje.toFixed(1)}%</td>
            </tr>`;
    });
    if (window.lucide) window.lucide.createIcons();
}

function filtrarArticulos() {
    const filtro = document.getElementById('filtro-articulos').value;
    renderTablaArticulos(filtro);
}

function renderTablaPedidos() {
    const tbody = document.querySelector('#tabla-pedidos tbody');
    tbody.innerHTML = '';
    // Mostrar los más recientes primero
    const pedidosArr = [...state.pedidos].reverse();
    pedidosArr.forEach(p => {
        const estadoClase = p.Estado === 'Pendiente' ? 'status-pendiente' : 
                           (p.Estado === 'Entregado' ? 'status-entregado' : 'status-cancelado');
        const fechaE = new Date(p.Fecha_Entrega).toLocaleDateString('es-AR');
        
        let totalVenta = 0;
        if(p.detalle) p.detalle.forEach(d => totalVenta += (d.P_Venta * d.Cantidad));
        else totalVenta = p.Total_Venta || 0;
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${p.N_Pedido}</strong></td>
                <td>${new Date(p.Fecha).toLocaleDateString('es-AR')}</td>
                <td>${p.Cliente_ID}</td>
                <td>${fechaE}</td>
                <td>
                    <div class="custom-select-wrapper">
                        <select class="status-badge ${estadoClase} modern-select" onchange="cambiarEstadoPedido('${p.N_Pedido}', this.value)">
                            <option value="Pendiente" ${p.Estado==='Pendiente'?'selected':''}>Pendiente</option>
                            <option value="Entregado" ${p.Estado==='Entregado'?'selected':''}>Entregado</option>
                            <option value="Cancelado" ${p.Estado==='Cancelado'?'selected':''}>Cancelado</option>
                        </select>
                        <i data-lucide="chevron-down" class="select-icon"></i>
                    </div>
                </td>
                <td style="color:var(--primary-color)"><strong>$${totalVenta}</strong></td>
            </tr>`;
    });
    if(window.lucide) window.lucide.createIcons();
    // Actualizar KPIs de la barra lateral
    updateSidebarStats();
}

async function cambiarEstadoPedido(nPedido, nuevoEstado) {
    const result = await Swal.fire({
        title: '¿Confirmar cambio?',
        text: `El pedido ${nPedido} pasará a estado: ${nuevoEstado}`,
        icon: 'warning',
        showCancelButton: true,
        background: '#111', color: '#fff', confirmButtonColor: '#d4af37'
    });

    if (result.isConfirmed) {
        Swal.fire({title:'Actualizando...', allowOutsideClick:false, didOpen:()=>Swal.showLoading()});
        try {
            const res = await apiCall('updateEstado', { N_Pedido: nPedido, Estado: nuevoEstado });
            if (res && res.success) {
                const p = state.pedidos.find(x => x.N_Pedido === nPedido);
                if(p) p.Estado = nuevoEstado;
                
                renderTablaPedidos();
                renderTablePagos(); // Por si cambió a Cancelado
                
                Swal.fire({title:'Actualizado', icon:'success', timer: 1500, background: '#111', color: '#fff', showConfirmButton:false});
            } else {
                throw new Error();
            }
        } catch (e) {
            Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
            renderTablaPedidos(); // rollback visual
        }
    } else {
        renderTablaPedidos(); // rollback visual si cancela
    }
}

function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    
    if(viewId === 'view-clientes') renderTablaClientes();
    if(viewId === 'view-articulos') renderTablaArticulos();
    if(viewId === 'view-pagos') renderTablePagos();
    
    // Sincronizar el sidebar si es una vista principal
    if (viewId === 'view-pedidos' || viewId === 'view-clientes' || viewId === 'view-articulos' || viewId === 'view-pagos') {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-target="${viewId}"]`);
        if (navItem) navItem.classList.add('active');
    }
}

function mostrarCrearPedido() {
    document.getElementById('form-pedido').reset();
    document.getElementById('pedido-cliente').dataset.id = '';
    state.currentOrderItems = [];
    renderOrderItems();
    showView('view-nuevo-pedido');
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    
    // Si abro modal cliente y no estoy editando, genero ID
    if(id === 'modal-cliente' && !window.isEditingCliente) {
        let nextIdNum = 1;
        if (state.clientes && state.clientes.length > 0) {
            const ids = state.clientes
                .map(c => parseInt(c.ID))
                .filter(n => !isNaN(n));
            if (ids.length > 0) nextIdNum = Math.max(...ids) + 1;
        }
        document.getElementById('cli-id').value = String(nextIdNum).padStart(4, '0');
    }
    if(id === 'modal-buscar-cliente') {
        document.getElementById('buscador-clientes-modal').value = '';
        renderModalClientes();
    }
    // Idem para artículo
    if(id === 'modal-articulo') {
        // Nada extra que cargar
    }
    if(id === 'modal-buscar-articulo') {
        document.getElementById('buscador-articulos-modal').value = '';
        renderModalArticulos();
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    const form = document.getElementById('form-' + id.split('-')[1]);
    if (form) form.reset();
}

// ── Cobranzas ──────────────────────────────────────
function abrirModalPago(nPedido, saldoSugerido) {
    document.getElementById('pago-pedido').value = nPedido;
    document.getElementById('pago-monto').value = saldoSugerido;
    openModal('modal-pago');
}

async function submitPago() {
    const btn = document.querySelector('#modal-pago .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    
    const payload = {
        N_Pedido: document.getElementById('pago-pedido').value,
        Monto: parseFloat(document.getElementById('pago-monto').value),
        Metodo: document.getElementById('pago-metodo').value,
        Notas: document.getElementById('pago-notas').value,
        Fecha: new Date().toLocaleDateString('es-AR')
    };
    
    try {
        await apiCall('addPago', payload);
        Swal.fire('¡Pago Registrado!', `Se registraron $${payload.Monto} para el pedido ${payload.N_Pedido}.`, 'success');
        closeModal('modal-pago');
        
        const res = await apiCall('getPagos');
        state.pagos = res;
        renderTablePagos();
    } catch(e) {
        Swal.fire('Error', 'Hubo un problema al guardar el pago.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar Pago';
    }
}

async function eliminarPago(nPedido, fecha, monto) {
    const result = await Swal.fire({
        title: '¿Eliminar este pago?',
        text: `Se borrará el pago de $${monto} cargado el ${fecha}. Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
        Swal.fire({title:'Eliminando...', allowOutsideClick:false, didOpen:()=>Swal.showLoading()});
        try {
            const res = await apiCall('deletePago', {N_Pedido: nPedido, Fecha: fecha, Monto: monto});
            if (res && res.success) {
                // Actualizar estado local
                const resPagos = await apiCall('getPagos');
                state.pagos = resPagos;
                
                // Si el modal de historial está abierto, recargarlo o cerrarlo
                const modalVer = document.getElementById('modal-ver-pagos');
                if (!modalVer.classList.contains('hidden')) {
                    // Si ya no quedan pagos, cerrarlo. Si quedan, re-renderizarlo.
                    const quedanPagos = state.pagos.filter(p => p.N_Pedido === nPedido).length > 0;
                    if (quedanPagos) {
                        verHistorialPagos(nPedido); // Re-render inside modal
                    } else {
                        closeModal('modal-ver-pagos');
                    }
                }
                
                renderTablePagos();
                Swal.fire('Eliminado!', 'El pago ha sido borrado.', 'success');
            } else {
                Swal.fire('Error', res.error || 'No se pudo eliminar.', 'error');
            }
        } catch(e) {
            Swal.fire('Error', 'Hubo un problema de conexión.', 'error');
        }
    }
}

// ── Formularios: Cliente y Artículo ────────────────
let isEditingCliente = false;

async function promptEditarCliente() {
    // Si el filtro dejó un único cliente en pantalla, lo editamos directo
    if (currentClientesRenderizados.length === 1) {
        editarCliente(currentClientesRenderizados[0].ID);
        return;
    }

    const { value: idStr } = await Swal.fire({
        title: 'Editar Cliente',
        input: 'text',
        inputLabel: 'Ingresá el ID del cliente que querés editar',
        inputPlaceholder: 'Ej: 0001',
        showCancelButton: true,
        confirmButtonText: 'Buscar',
        cancelButtonText: 'Cancelar'
    });

    if (idStr) {
        const c = state.clientes.find(x => String(x.ID) === String(idStr).trim());
        if (c) {
            editarCliente(c.ID);
        } else {
            Swal.fire('No encontrado', `No existe un cliente con el ID ${idStr}`, 'error');
        }
    }
}

async function promptEditarArticulo() {
    // Si el filtro dejó un único artículo en pantalla, lo editamos directo
    if (currentArticulosRenderizados.length === 1) {
        editarArticulo(currentArticulosRenderizados[0].Codigo);
        return;
    }

    const { value: codigo } = await Swal.fire({
        title: 'Editar Artículo',
        input: 'text',
        inputLabel: 'Ingresá el Código del artículo que querés editar',
        inputPlaceholder: 'Ej: 202020',
        showCancelButton: true,
        confirmButtonText: 'Buscar',
        cancelButtonText: 'Cancelar'
    });

    if (codigo) {
        const a = state.articulos.find(x => String(x.Codigo) === String(codigo).trim());
        if (a) {
            editarArticulo(a.Codigo);
        } else {
            Swal.fire('No encontrado', `No existe un artículo con el código ${codigo}`, 'error');
        }
    }
}

function editarCliente(id) {
    window.isEditingCliente = true;
    const c = state.clientes.find(x => String(x.ID) === String(id));
    if(!c) return;
    
    document.getElementById('cli-id').value = c.ID;
    document.getElementById('cli-nombre').value = c.Nombre;
    document.getElementById('cli-telefono').value = c.Telefono;
    document.getElementById('cli-direccion').value = c.Direccion;
    document.getElementById('cli-notas').value = c.Notas || '';
    
    openModal('modal-cliente');
}

async function submitCliente() {
    const p = {
        ID: document.getElementById('cli-id').value.trim(),
        Nombre: document.getElementById('cli-nombre').value.trim(),
        Telefono: document.getElementById('cli-telefono').value.trim(),
        Direccion: document.getElementById('cli-direccion').value.trim(),
        Notas: document.getElementById('cli-notas').value.trim()
    };
    if (!p.ID || !p.Nombre || !p.Telefono) return Swal.fire('Error', 'Completa ID, Nombre y Teléfono', 'error');

    Swal.fire({title:'Guardando...', allowOutsideClick:false, didOpen:()=>Swal.showLoading()});
    const action = window.isEditingCliente ? 'updateCliente' : 'addCliente';
    
    try {
        const res = await apiCall(action, p);
        if (res && res.success) {
            Swal.fire('¡Éxito!', window.isEditingCliente ? 'Cliente actualizado.' : 'Cliente creado.', 'success');
            closeModal('modal-cliente');
            
            if (!window.isEditingCliente) {
                seleccionarClienteParaPedido(p.ID, p.Nombre);
            }
            
            window.isEditingCliente = false; // Reset
            loadClientes();
        }
    } catch(e) {
        Swal.fire('Error', 'Hubo un problema.', 'error');
    }
}

function editarArticulo(codigo) {
    window.isEditingArticulo = true;
    const a = state.articulos.find(x => String(x.Codigo) === String(codigo));
    if(!a) return;
    
    document.getElementById('art-codigo').value = a.Codigo;
    document.getElementById('art-codigo').readOnly = true;
    
    document.getElementById('art-marca').value = a.Marca;
    document.getElementById('art-descripcion').value = a.Descripcion;
    document.getElementById('art-costo').value = a.Precio_Compra;
    document.getElementById('art-venta').value = a.Precio_Venta;
    
    openModal('modal-articulo');
}

async function submitArticulo() {
    const p = {
        Codigo: document.getElementById('art-codigo').value.trim(),
        Marca: document.getElementById('art-marca').value,
        Descripcion: document.getElementById('art-descripcion').value.trim(),
        Precio_Compra: parseFloat(document.getElementById('art-costo').value),
        Precio_Venta: parseFloat(document.getElementById('art-venta').value)
    };
    if (!p.Codigo || !p.Descripcion || isNaN(p.Precio_Compra) || isNaN(p.Precio_Venta)) 
        return Swal.fire('Error', 'Completa los datos correctamente', 'error');

    Swal.fire({title:'Guardando...', allowOutsideClick:false, didOpen:()=>Swal.showLoading()});
    const action = window.isEditingArticulo ? 'updateArticulo' : 'addArticulo';

    try {
        const res = await apiCall(action, p);
        if (res && res.success) {
            Swal.fire('¡Éxito!', window.isEditingArticulo ? 'Artículo actualizado.' : 'Artículo creado.', 'success');
            closeModal('modal-articulo');
            
            if (!window.isEditingArticulo) {
                seleccionarArticuloParaPedido(p.Codigo, p.Descripcion, p.Precio_Venta);
            }
            
            document.getElementById('art-codigo').readOnly = false;
            window.isEditingArticulo = false;
            loadArticulos();
        }
    } catch(e) {
        Swal.fire('Error', 'Hubo un problema.', 'error');
    }
}

// ── Autocomplete Logic ─────────────────────────────
function setupAutocomplete(inputId, resultsId, searchFn, selectFn, createNewFn) {
    const input = document.getElementById(inputId);
    const resultsContainer = document.getElementById(resultsId);

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        resultsContainer.innerHTML = '';
        if (val.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }

        const matches = searchFn(val);
        
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'ac-item';
            div.innerHTML = m.html;
            div.addEventListener('click', () => {
                selectFn(m.data);
                input.value = m.text;
                resultsContainer.classList.add('hidden');
            });
            resultsContainer.appendChild(div);
        });

        // Opción de crear nuevo
        const createDiv = document.createElement('div');
        createDiv.className = 'ac-item ac-item-new';
        createDiv.innerHTML = `<i data-lucide="plus"></i> Crear "${val}"...`;
        createDiv.addEventListener('click', () => {
            resultsContainer.classList.add('hidden');
            createNewFn();
        });
        resultsContainer.appendChild(createDiv);
        
        lucide.createIcons();
        resultsContainer.classList.remove('hidden');
    });

    // Ocultar si se hace click afuera
    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target.parentNode !== resultsContainer) {
            resultsContainer.classList.add('hidden');
        }
    });
}

// ── Lógica Buscador Modal Cliente ──────────────────
function renderModalClientes(filtro = '') {
    const tbody = document.querySelector('#tabla-modal-clientes tbody');
    tbody.innerHTML = '';
    const f = filtro.toLowerCase();
    
    const filtrados = state.clientes.filter(c => 
        String(c.ID).toLowerCase().includes(f) || 
        String(c.Nombre).toLowerCase().includes(f) ||
        String(c.Telefono).toLowerCase().includes(f)
    );

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: #888; padding: 20px;">No se encontraron clientes.</td></tr>`;
        return;
    }

    filtrados.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${c.ID}</strong></td>
                <td>${c.Nombre}</td>
                <td>${c.Telefono}</td>
                <td>
                    <button type="button" class="btn-secondary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="seleccionarClienteParaPedido('${c.ID}', '${c.Nombre}')">Seleccionar</button>
                </td>
            </tr>`;
    });
}

function seleccionarClienteParaPedido(id, nombre) {
    const input = document.getElementById('pedido-cliente');
    input.value = `${nombre} (${id})`;
    input.dataset.id = id;
    closeModal('modal-buscar-cliente');
}

// ── Lógica Buscador Modal Articulos ────────────────
function renderModalArticulos(filtro = '') {
    const tbody = document.querySelector('#tabla-modal-articulos tbody');
    tbody.innerHTML = '';
    const f = filtro.toLowerCase();
    
    const filtrados = state.articulos.filter(a => 
        String(a.Codigo).toLowerCase().includes(f) || 
        String(a.Marca).toLowerCase().includes(f) ||
        String(a.Descripcion).toLowerCase().includes(f)
    );

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #888; padding: 20px;">No se encontraron artículos.</td></tr>`;
        return;
    }

    filtrados.forEach(a => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${a.Codigo}</strong></td>
                <td><span class="badge">${a.Marca}</span></td>
                <td>${a.Descripcion}</td>
                <td style="color:var(--primary-color)"><strong>$${a.Precio_Venta}</strong></td>
                <td>
                    <button type="button" class="btn-secondary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="seleccionarArticuloParaPedido('${a.Codigo}', '${a.Descripcion}', ${a.Precio_Venta})">Seleccionar</button>
                </td>
            </tr>`;
    });
}

function seleccionarArticuloParaPedido(codigo, descripcion, precio) {
    const input = document.getElementById('item-search');
    input.value = `${descripcion} (${codigo})`;
    input.dataset.codigo = codigo;
    closeModal('modal-buscar-articulo');
    
    // Auto-focus en cantidad y seleccionar todo el texto
    setTimeout(() => {
        const qtyInput = document.getElementById('item-qty');
        qtyInput.value = '0';
        qtyInput.focus();
        qtyInput.select();
    }, 150);
}

// Asegurar que al hacer clic manualmente en "Cantidad" también se seleccione todo
document.addEventListener('DOMContentLoaded', () => {
    const qtyInput = document.getElementById('item-qty');
    if (qtyInput) {
        qtyInput.addEventListener('focus', function() {
            this.select();
        });
        qtyInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addOrderItem();
            }
        });
    }
});

// ── Lógica de Items del Pedido ─────────────────────
function addOrderItem() {
    const inputBusqueda = document.getElementById('item-search');
    const inputCant = document.getElementById('item-qty');
    const val = inputBusqueda.dataset.codigo;
    const cant = parseInt(inputCant.value);

    if (!val || cant < 1) {
        return Swal.fire('Atención', 'Selecciona un artículo y cantidad mayor a 0.', 'warning');
    }

    // Buscar si el articulo existe
    const art = state.articulos.find(a => String(a.Codigo) === String(val));
    if (!art) {
        Swal.fire('Atención', 'El artículo no es válido.', 'warning');
        return;
    }

    state.currentOrderItems.push({
        Codigo_Art: art.Codigo,
        Descripcion: art.Descripcion,
        Cantidad: cant,
        P_Compra: art.Precio_Compra,
        P_Venta: art.Precio_Venta
    });

    inputBusqueda.value = '';
    delete inputBusqueda.dataset.codigo;
    inputCant.value = '0';
    renderOrderItems();
}

function removeOrderItem(index) {
    state.currentOrderItems.splice(index, 1);
    renderOrderItems();
}

function renderOrderItems() {
    const list = document.getElementById('order-items-list');
    let totalC = 0, totalV = 0;

    if (state.currentOrderItems.length === 0) {
        list.innerHTML = '<div class="empty-items-msg">Aún no has agregado artículos.</div>';
    } else {
        list.innerHTML = '';
        state.currentOrderItems.forEach((item, idx) => {
            const subV = item.P_Venta * item.Cantidad;
            totalC += item.P_Compra * item.Cantidad;
            totalV += subV;

            list.innerHTML += `
                <div class="order-item-row">
                    <div class="item-desc">
                        <strong>${item.Cantidad}x</strong> ${item.Descripcion} <br>
                        <small style="color:#888">${item.Codigo_Art}</small>
                    </div>
                    <div class="item-meta">
                        <span class="item-price">$${subV}</span>
                        <button type="button" class="btn-icon" onclick="removeOrderItem(${idx})" style="color:#ff4444"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
            `;
        });
        lucide.createIcons();
    }

    document.getElementById('total-venta-calc').innerText = `$${totalV}`;
    document.getElementById('total-costo-calc').innerText = `$${totalC}`;
    document.getElementById('total-ganancia-calc').innerText = `$${totalV - totalC}`;
}

// ── Enviar Pedido ──────────────────────────────────
async function submitPedido() {
    const inputElem = document.getElementById('pedido-cliente');
    const clienteId = inputElem.dataset.id || inputElem.value.trim();
    const fechaEnt = document.getElementById('pedido-fecha-entrega').value;

    if (!clienteId || !fechaEnt) {
        return Swal.fire('Error', 'Debe indicar Cliente y Fecha de Entrega', 'error');
    }
    if (state.currentOrderItems.length === 0) {
        return Swal.fire('Error', 'El pedido no tiene artículos', 'error');
    }

    // Verificar si el cliente existe realmente
    if (!state.clientes.find(c => String(c.ID) === String(clienteId))) {
        return Swal.fire('Atención', 'El ID de cliente no existe. Créelo primero.', 'warning');
    }

    const payload = {
        Cliente_ID: clienteId,
        Fecha_Entrega: fechaEnt,
        detalle: state.currentOrderItems
    };

    Swal.fire({title:'Procesando Pedido...', allowOutsideClick:false, didOpen:()=>Swal.showLoading()});
    
    const res = await apiCall('addPedido', payload);
    if (res && res.success) {
        Swal.fire({
            icon: 'success',
            title: '¡Pedido Generado!',
            text: `Se generó el pedido ${res.nPedido} y se envió el email.`,
            background: '#111', color: '#fff', confirmButtonColor: '#d4af37'
        });
        showView('view-pedidos');
        loadPedidos();
    }
}

// ── Actualización de Estadísticas ──────────────────
function updateSidebarStats() {
    const pendientes = state.pedidos.filter(p => p.Estado === 'Pendiente').length;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let ventasMes = 0;
    let gananciaMes = 0;
    let totalVendidoHistorico = 0;

    state.pedidos.forEach(p => {
        if (p.Estado !== 'Cancelado') {
            let venta = 0;
            let costo = 0;
            if (p.detalle) {
                p.detalle.forEach(d => {
                    venta += (parseFloat(d.P_Venta) * parseInt(d.Cantidad)) || 0;
                    costo += (parseFloat(d.P_Compra) * parseInt(d.Cantidad)) || 0;
                });
            } else {
                venta = parseFloat(p.Total_Venta) || 0;
                costo = parseFloat(p.Total_Costo) || 0;
            }
            const ganancia = parseFloat(p.Ganancia) || (venta - costo);
            
            totalVendidoHistorico += venta;

            let isCurrentMonth = false;
            const dateP = new Date(p.Fecha);
            if (!isNaN(dateP)) {
                isCurrentMonth = (dateP.getMonth() === currentMonth && dateP.getFullYear() === currentYear);
            } else {
                const [d, m, y] = String(p.Fecha).split(/[/-]/);
                if (d && m && y) {
                    const parsedDate = new Date(y, m-1, d);
                    isCurrentMonth = (parsedDate.getMonth() === currentMonth && parsedDate.getFullYear() === currentYear);
                }
            }

            if (isCurrentMonth) {
                ventasMes += venta;
                gananciaMes += ganancia;
            }
        }
    });

    let totalCobradoHistorico = 0;
    state.pagos.forEach(p => {
        totalCobradoHistorico += parseFloat(p.Monto) || 0;
    });

    const aCobrar = totalVendidoHistorico - totalCobradoHistorico;

    if (document.getElementById('stat-pendientes')) {
        document.getElementById('stat-pendientes').textContent = pendientes;
        document.getElementById('stat-ventas').textContent = `$${ventasMes.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        document.getElementById('stat-ganancia').textContent = `$${gananciaMes.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        document.getElementById('stat-cobrar').textContent = `$${aCobrar.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    }
}
