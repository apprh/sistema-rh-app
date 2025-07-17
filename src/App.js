import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    query,
    runTransaction,
    writeBatch,
    where,
    getDocs,
    serverTimestamp,
    orderBy,
    setDoc,
    getDoc,
    deleteDoc
} from 'firebase/firestore';
import { Plus, Users, FileText, UserMinus, BarChart3, Briefcase, UserCheck, X, Archive, Edit, UserX, Search, ChevronDown, ChevronUp, IdCard, MoreVertical, History, AlertTriangle, Shield, LogOut, Eye, EyeOff, UserCircle, ChevronLeft, UserPlus, LayoutDashboard, Calendar, Clock, Trash2, UserCog, BookText, Bell, Wand2 } from 'lucide-react';

// --- Configuração do Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyCGacNPJTKirvEGFCiMKh9cbovIae4S0hE",
    authDomain: "sistema-rh-c1987.firebaseapp.com",
    projectId: "sistema-rh-c1987",
    storageBucket: "sistema-rh-c1987.appspot.com",
    messagingSenderId: "675893937175",
    appId: "1:675893937175:web:6b29ed67b1327c3cdbc852",
    measurementId: "G-53RGD52TWC"
};

let app, auth, db;
try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Falha crítica na inicialização do Firebase:", e);
}

// --- Funções de Utilitários ---
const createLog = async (user, action, details) => {
    if (!user || !user.uid) return;
    try {
        await addDoc(collection(db, 'audit_logs'), {
            timestamp: serverTimestamp(),
            userId: user.uid,
            userName: user.name || user.email,
            userEmail: user.email,
            action,
            details,
        });
    } catch (error) {
        console.error("Erro ao criar log de auditoria:", error);
    }
};

const createNotification = async (targetUserId, message, details) => {
    if (!targetUserId) return;
    try {
        await addDoc(collection(db, 'notifications'), {
            targetUserId,
            message,
            details,
            read: false,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Erro ao criar notificação:", error);
    }
};

// --- Contexto de Autenticação ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                let userDocSnap = await getDoc(userDocRef);

                if (!userDocSnap.exists()) {
                    console.log("Documento de usuário não encontrado, criando um novo...");
                    const rolesCollectionRef = collection(db, 'roles');
                    let adminRoleId = null;
                    try {
                        const adminQuery = query(rolesCollectionRef, where("name", "==", "Administrador"));
                        const adminSnapshot = await getDocs(adminQuery);

                        if (!adminSnapshot.empty && firebaseUser.email.toLowerCase() === 'thami.santos@grupovillela.com') {
                            adminRoleId = adminSnapshot.docs[0].id;
                        }

                        await setDoc(userDocRef, {
                            name: firebaseUser.displayName || 'Nome não definido',
                            email: firebaseUser.email,
                            roleId: adminRoleId,
                            createdAt: serverTimestamp()
                        });
                        userDocSnap = await getDoc(userDocRef);
                    } catch (error) {
                        console.error("Erro ao criar documento de usuário:", error);
                    }
                }

                if (userDocSnap.exists()) {
                    const baseUserData = { uid: firebaseUser.uid, ...userDocSnap.data() };
                    
                    if (baseUserData.roleId) {
                        const roleDocRef = doc(db, 'roles', baseUserData.roleId);
                        const roleDocSnap = await getDoc(roleDocRef);
                        if (roleDocSnap.exists()) {
                            baseUserData.permissions = roleDocSnap.data().permissions;
                        } else {
                             baseUserData.permissions = {};
                             console.error("Papel NÃO encontrado na coleção 'roles' com o ID:", baseUserData.roleId);
                        }
                    } else {
                        baseUserData.permissions = {};
                    }
                    setUserData(baseUserData);
                }
                setUser(firebaseUser);

            } else {
                setUser(null);
                setUserData(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const value = { user, userData, loading };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

const useAuth = () => {
    return useContext(AuthContext);
};

// --- Componente de Error Boundary ---
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, errorInfo) {
        console.error("Erro capturado:", error, errorInfo);
        this.setState({ errorInfo: errorInfo });
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-red-700 bg-red-100 h-screen flex flex-col items-center justify-center">
                    <AlertTriangle size={48} className="mb-4" />
                    <h1 className="text-2xl font-bold mb-4">Ocorreu um erro na aplicação.</h1>
                    <pre className="mt-4 p-4 bg-white text-sm text-red-800 rounded-lg shadow w-full max-w-2xl overflow-auto">
                        {this.state.error.toString()}<br />{this.state.errorInfo?.componentStack}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

// --- Lista de Permissões Disponíveis no Sistema ---
const PERMISSIONS_LIST = [
    { id: 'manage_recruitment', label: 'Gerenciar Recrutamento (Vagas e Candidatos)' },
    { id: 'manage_contracts', label: 'Gerenciar Contratações' },
    { id: 'view_collaborators', label: 'Visualizar Base de Colaboradores' },
    { id: 'manage_collaborators', label: 'Gerenciar Colaboradores (Editar, Transferir, Desligar)' },
    { id: 'view_talent_pool', label: 'Visualizar Banco de Talentos (Reprovados/Desistências)' },
    { id: 'view_terminated', label: 'Visualizar Base de Desligados' },
    { id: 'manage_permissions', label: 'Gerenciar Permissões e Papéis' },
    { id: 'view_reports', label: 'Visualizar Relatórios (Turnover, etc)' },
    { id: 'view_audit_logs', label: 'Visualizar Logs de Auditoria' },
];


// --- Componentes ---

const PlaceholderPage = ({ title, icon }) => (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
        {icon}
        <h1 className="text-4xl font-bold mt-4">{title}</h1>
        <p className="mt-2 text-lg">Esta página está em construção.</p>
    </div>
);

const DashboardHomePage = ({ setCurrentPage }) => {
    const { userData } = useAuth();
    const DashboardCard = ({ title, description, icon, link, pageName, permission }) => {
        if (permission && !userData?.permissions?.[permission]) return null;
        return (
            <div 
                className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg hover:border-blue-500 transition-all cursor-pointer flex flex-col"
                onClick={() => setCurrentPage(pageName)} >
                <div className="flex-shrink-0 text-blue-600">{icon}</div>
                <div className="mt-4 flex-grow">
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    <p className="text-gray-600 mt-2">{description}</p>
                </div>
                <div className="mt-4">
                    <span className="font-semibold text-blue-600 hover:text-blue-800">{link}</span>
                </div>
            </div>
        );
    }
    const cards = [
        { title: "Recrutamento", description: "Gerencie vagas, candidatos e todo o processo seletivo.", icon: <FileText size={40} />, link: "Ver Vagas", pageName: "recrutamento", permission: "manage_recruitment" },
        { title: "Base de Colaboradores", description: "Acesse e gerencie os dados de todos os colaboradores ativos.", icon: <Users size={40} />, link: "Acessar Base", pageName: "colaboradores", permission: "view_collaborators" },
        { title: "Contratações", description: "Acompanhe os candidatos em processo de admissão.", icon: <IdCard size={40} />, link: "Ver Contratações", pageName: "contratos", permission: "manage_contracts" },
        { title: "Banco de Talentos", description: "Consulte perfis reprovados ou que desistiram para futuras oportunidades.", icon: <Archive size={40} />, link: "Consultar Perfis", pageName: "reprovados", permission: "view_talent_pool" },
        { title: "Desligados", description: "Acesse o histórico de colaboradores que foram desligados.", icon: <UserMinus size={40} />, link: "Ver Histórico", pageName: "demitidos", permission: "view_terminated" },
        { title: "Turnover", description: "Analise métricas e relatórios de rotatividade (em breve).", icon: <BarChart3 size={40} />, link: "Ver Relatórios", pageName: "turnover", permission: "view_reports" }
    ];
    const visibleCards = cards.filter(card => !card.permission || userData?.permissions?.[card.permission]);
    return (
        <div>
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-800">Bem-vindo(a), {userData?.name || 'Usuário'}!</h1>
                <p className="text-lg text-gray-600 mt-2">Aqui está um resumo das suas informações e acessos rápidos.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleCards.length > 0 ? (
                    visibleCards.map(card => <DashboardCard key={card.pageName} {...card} />)
                ) : (
                    <div className="col-span-full bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-6 rounded-lg">
                        <h3 className="font-bold">Sem permissões atribuídas</h3>
                        <p>Seu usuário ainda não tem um papel com permissões definidas. Por favor, entre em contato com um administrador do sistema para que ele possa atribuir um papel ao seu perfil.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- PÁGINA DE PERMISSÕES E SEUS SUB-COMPONENTES ---

const PermissionsPage = ({ onSave, onClose, profile }) => {
    const { userData } = useAuth();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState(null);

    useEffect(() => {
        const rolesCollectionPath = 'roles';
        const q = query(collection(db, rolesCollectionPath));
        const unsubscribe = onSnapshot(q, snapshot => {
            setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const handleSaveRole = async (roleData) => {
        const rolesCollectionPath = 'roles';
        try {
            if (roleData.id) {
                const roleDocRef = doc(db, rolesCollectionPath, roleData.id);
                const { id, ...dataToUpdate } = roleData;
                await updateDoc(roleDocRef, dataToUpdate);
                await createLog(userData, 'UPDATE_ROLE', { roleId: id, roleName: dataToUpdate.name });
            } else {
                const { id, ...dataToCreate } = roleData;
                const newRoleRef = await addDoc(collection(db, rolesCollectionPath), dataToCreate);
                await createLog(userData, 'CREATE_ROLE', { roleId: newRoleRef.id, roleName: dataToCreate.name });
            }
            setShowRoleModal(false);
            setSelectedRole(null);
        } catch (error) {
            console.error("Erro ao salvar papel:", error);
        }
    };

    const confirmDeleteRole = (roleId) => {
        setRoleToDelete(roleId);
        setShowConfirmModal(true);
    };
    
    const handleDeleteRole = async () => {
        if (!roleToDelete) return;
        try {
            const roleToDeleteData = roles.find(r => r.id === roleToDelete);
            await deleteDoc(doc(db, 'roles', roleToDelete));
            await createLog(userData, 'DELETE_ROLE', { roleId: roleToDelete, roleName: roleToDeleteData?.name || 'N/A' });
            setShowConfirmModal(false);
            setRoleToDelete(null);
        } catch (error) {
            console.error("Erro ao excluir papel:", error);
            setShowConfirmModal(false);
            setRoleToDelete(null);
        }
    };

    const handleOpenAssignModal = (role) => {
        setSelectedRole(role);
        setShowAssignModal(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Papéis e Permissões</h1>
                <button
                    onClick={() => { setSelectedRole(null); setShowRoleModal(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center"
                >
                    <Plus size={20} className="mr-2" /> Criar Novo Papel
                </button>
            </div>
            {loading ? <p>Carregando papéis...</p> : (
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left text-sm font-semibold text-gray-600">Papel</th>
                                <th className="p-3 text-left text-sm font-semibold text-gray-600">Descrição</th>
                                <th className="p-3 text-center text-sm font-semibold text-gray-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map(role => (
                                <tr key={role.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium text-gray-800">{role.name}</td>
                                    <td className="p-3 text-gray-600">{role.description}</td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => handleOpenAssignModal(role)} className="text-green-600 hover:text-green-800 p-2" title="Atribuir Usuários"><UserCog size={18} /></button>
                                        <button onClick={() => { setSelectedRole(role); setShowRoleModal(true); }} className="text-blue-600 hover:text-blue-800 p-2" title="Editar Papel"><Edit size={18} /></button>
                                        <button onClick={() => confirmDeleteRole(role.id)} className="text-red-600 hover:text-red-800 p-2" title="Excluir Papel"><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {showRoleModal && <RoleFormModal role={selectedRole} onSave={handleSaveRole} onClose={() => setShowRoleModal(false)} />}
            {showAssignModal && <AssignUserModal role={selectedRole} onClose={() => setShowAssignModal(false)} />}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h3 className="text-lg font-bold">Confirmar Exclusão</h3>
                        <p className="my-4">Tem certeza que deseja excluir este papel? Esta ação não pode ser desfeita.</p>
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setShowConfirmModal(false)} className="bg-gray-300 text-black px-4 py-2 rounded-lg">Cancelar</button>
                            <button onClick={handleDeleteRole} className="bg-red-600 text-white px-4 py-2 rounded-lg">Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const RoleFormModal = ({ role, onSave, onClose }) => {
    const [name, setName] = useState(role?.name || '');
    const [description, setDescription] = useState(role?.description || '');
    const [permissions, setPermissions] = useState(role?.permissions || {});

    const handlePermissionChange = (permId) => {
        setPermissions(prev => ({ ...prev, [permId]: !prev[permId] }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ id: role?.id, name, description, permissions });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">{role ? 'Editar Papel' : 'Criar Novo Papel'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2" htmlFor="roleName">Nome do Papel</label>
                        <input type="text" id="roleName" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2" htmlFor="roleDescription">Descrição</label>
                        <textarea id="roleDescription" value={description} onChange={e => setDescription(e.target.value)} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-lg"></textarea>
                    </div>
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-3">Permissões</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg max-h-60 overflow-y-auto">
                            {PERMISSIONS_LIST.map(perm => (
                                <label key={perm.id} className="flex items-center space-x-3">
                                    <input type="checkbox" checked={!!permissions[perm.id]} onChange={() => handlePermissionChange(perm.id)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="text-gray-700">{perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-8">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg">Cancelar</button>
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AssignUserModal = ({ role, onClose }) => {
    const { userData } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const usersCollection = collection(db, 'users');
        const unsubscribe = onSnapshot(usersCollection, snapshot => {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const handleAssignRole = async (targetUser, newRoleId) => {
        const userDocRef = doc(db, 'users', targetUser.id);
        try {
            await updateDoc(userDocRef, { roleId: newRoleId });
            await createLog(userData, 'ASSIGN_ROLE', { 
                targetUserId: targetUser.id, 
                targetUserName: targetUser.name,
                roleId: newRoleId,
                roleName: role.name 
            });
        } catch (error) {
            console.error("Erro ao atribuir papel:", error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Atribuir Papel: <span className="text-blue-600">{role.name}</span></h2>
                <p className="text-gray-600 mb-6">Selecione os usuários que terão este papel. A mudança é aplicada instantaneamente.</p>
                <div className="border rounded-lg max-h-80 overflow-y-auto">
                    {loading ? <p>Carregando usuários...</p> : (
                        <table className="w-full">
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">
                                            <p className="font-medium text-gray-800">{user.name}</p>
                                            <p className="text-sm text-gray-500">{user.email}</p>
                                        </td>
                                        <td className="p-3 text-right">
                                            <input
                                                type="checkbox"
                                                checked={user.roleId === role.id}
                                                onChange={() => handleAssignRole(user, user.roleId === role.id ? null : role.id)}
                                                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="flex justify-end mt-6">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg">Fechar</button>
                </div>
            </div>
        </div>
    );
};

const AuditLogPage = ({ onSave, onClose, profile }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const logsCollectionRef = collection(db, 'audit_logs');
        const q = query(logsCollectionRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate()
                };
            });
            setLogs(logData);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const formatAction = (action) => {
        const actions = {
            'CREATE_ROLE': 'Criação de Papel',
            'UPDATE_ROLE': 'Atualização de Papel',
            'DELETE_ROLE': 'Exclusão de Papel',
            'ASSIGN_ROLE': 'Atribuição de Papel',
        };
        return actions[action] || action;
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">Logs de Auditoria</h1>
            {loading ? <p>Carregando logs...</p> : (
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-3 text-left text-sm font-semibold text-gray-600">Data</th>
                                    <th className="p-3 text-left text-sm font-semibold text-gray-600">Usuário</th>
                                    <th className="p-3 text-left text-sm font-semibold text-gray-600">Ação</th>
                                    <th className="p-3 text-left text-sm font-semibold text-gray-600">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3 text-sm text-gray-500 whitespace-nowrap">
                                            {log.timestamp ? log.timestamp.toLocaleString('pt-BR') : 'N/A'}
                                        </td>
                                        <td className="p-3 text-gray-800">
                                            <p className="font-medium">{log.userName}</p>
                                            <p className="text-xs text-gray-500">{log.userEmail}</p>
                                        </td>
                                        <td className="p-3 font-medium text-gray-700">{formatAction(log.action)}</td>
                                        <td className="p-3 text-sm text-gray-600">
                                            <pre className="bg-gray-100 p-2 rounded text-xs"><code>{JSON.stringify(log.details, null, 2)}</code></pre>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const NotificationsPage = ({ onSave, onClose, profile }) => {
    const { userData } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userData?.uid) return;
        const q = query(collection(db, 'notifications'), where('targetUserId', '==', userData.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            notifData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

            setNotifications(notifData);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar notificações:", error);
            setLoading(false);
        });
        return unsubscribe;
    }, [userData?.uid]);

    const handleMarkAsRead = async (id) => {
        const notifRef = doc(db, 'notifications', id);
        await updateDoc(notifRef, { read: true });
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">Minhas Notificações</h1>
            {loading ? <p>Carregando...</p> : (
                 <div className="space-y-4">
                    {notifications.length > 0 ? notifications.map(notif => (
                        <div key={notif.id} className={`p-4 rounded-lg flex items-start gap-4 ${notif.read ? 'bg-gray-100' : 'bg-blue-50 border border-blue-200'}`}>
                            <div className={`mt-1 h-3 w-3 rounded-full ${!notif.read ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className="flex-1">
                                <p className="text-gray-800">{notif.message}</p>
                                <p className="text-xs text-gray-500 mt-1">{notif.createdAt?.toDate().toLocaleString('pt-BR')}</p>
                            </div>
                            {!notif.read && (
                                <button onClick={() => handleMarkAsRead(notif.id)} className="text-sm text-blue-600 hover:underline">
                                    Marcar como lida
                                </button>
                            )}
                        </div>
                    )) : (
                        <p className="text-center text-gray-500 py-8">Nenhuma notificação encontrada.</p>
                    )}
                 </div>
            )}
        </div>
    );
};

// --- DEMAIS COMPONENTES ---

const JobCard = ({ job, onSelect }) => {
    const getStatusStyle = () => {
        switch (job.status) {
            case 'Aberta': return 'bg-green-100 text-green-800';
            case 'Vaga Reaberta': return 'bg-purple-100 text-purple-800';
            case 'Em andamento': return 'bg-blue-100 text-blue-800';
            case 'Entrevista com Recrutador':
            case 'Reagendamento com Recrutador':
                return 'bg-yellow-100 text-yellow-800';
            case 'Entrevista com Gestor':
            case 'Reagendamento com Gestor':
                return 'bg-orange-100 text-orange-800';
            case 'Finalizada': return 'bg-gray-200 text-gray-700';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    return (
        <div className={`bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg hover:border-blue-400 transition-all cursor-pointer ${job.status === 'Finalizada' ? 'opacity-70' : ''}`} onClick={onSelect}>
            <h3 className="text-xl font-bold text-blue-800">{job.jobTitle}</h3>
            <p className="text-gray-600 mt-2">Equipe: {job.team}</p>
            <p className="text-gray-500 text-sm mt-1">Abertura por: {job.hiringManager}</p>
            <div className="mt-4 flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-800">{job.approvedCount || 0}/{job.positions} vagas</span>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusStyle()}`}>{job.status}</span>
            </div>
        </div>
    );
};

const JobCreationForm = ({ onSubmit, onCancel }) => {
    const { userData } = useAuth();
    const [jobTitle, setJobTitle] = useState('');
    const [team, setTeam] = useState('');
    const [positions, setPositions] = useState(1);
    const [jobValue, setJobValue] = useState('');
    const [costCenter, setCostCenter] = useState('');
    const [hiringCompany, setHiringCompany] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateDescription = async () => {
        if (!jobTitle) {
            alert("Por favor, preencha o Nome da Vaga para gerar a descrição.");
            return;
        }
        setIsGenerating(true);
        const prompt = `Escreva uma descrição de vaga de emprego detalhada e profissional para o cargo de "${jobTitle}" na equipe de "${team || 'não especificada'}". A descrição deve ser em português do Brasil e incluir seções para: Responsabilidades Principais, Qualificações Essenciais e Qualificações Desejáveis.`;
        
        try {
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content?.parts?.[0]?.text) {
                const text = result.candidates[0].content.parts[0].text;
                setJobDescription(text);
            } else {
                console.error("Resposta da API em formato inesperado:", result);
                alert("Não foi possível gerar a descrição. Tente novamente.");
            }
        } catch (error) {
            console.error("Erro ao chamar a API Gemini:", error);
            alert("Ocorreu um erro ao gerar a descrição.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            jobTitle,
            team,
            hiringManager: userData.name,
            hiringManagerId: userData.uid,
            positions: Number(positions),
            jobValue: parseFloat(jobValue),
            costCenter,
            hiringCompany,
            jobDescription,
        });
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Criar Nova Vaga</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input type="text" placeholder="Nome da Vaga" value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    <input type="text" placeholder="Equipe" value={team} onChange={e => setTeam(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>

                <div className="space-y-2">
                    <label className="block text-gray-700 font-semibold">Descrição da Vaga</label>
                    <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows="10" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Descreva as responsabilidades, qualificações, etc."></textarea>
                    <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-300">
                        <Wand2 size={16} />
                        {isGenerating ? 'Gerando...' : '✨ Gerar Descrição com IA'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input type="number" placeholder="Quantidade de Vagas" value={positions} onChange={e => setPositions(e.target.value)} min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    <input type="number" placeholder="Valor da Vaga (Salário)" value={jobValue} onChange={e => setJobValue(e.target.value)} step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    <input type="text" placeholder="Empresa Contratante" value={hiringCompany} onChange={e => setHiringCompany(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    <input type="text" placeholder="Centro de Custo" value={costCenter} onChange={e => setCostCenter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
                
                <div className="flex justify-end gap-4 mt-4">
                    <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg">Cancelar</button>
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg">Salvar Vaga</button>
                </div>
            </form>
        </div>
    );
};

const JobDetailView = ({ job, onBack }) => {
    const [isEditingRecruiter, setIsEditingRecruiter] = useState(!job.recruiter);
    const [showCandidateForm, setShowCandidateForm] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fullHistory, setFullHistory] = useState([]);
    const [showQuestionsModal, setShowQuestionsModal] = useState(false);

    useEffect(() => {
        if (job.status === 'Finalizada') {
            setLoading(false);
            return;
        };
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const candidatesCollectionPath = `artifacts/${appId}/public/data/jobOpenings/${job.id}/candidates`;
        const q = query(collection(db, candidatesCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const candidatesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCandidates(candidatesData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [job.id, job.status]);

    useEffect(() => {
        if (job.status !== 'Finalizada') return;

        const fetchHistory = async () => {
            setLoading(true);
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
            const collectionsToQuery = [
                { path: 'collaborators', status: 'Contratado' },
                { path: 'disapprovedProfiles', status: 'Reprovado' },
                { path: 'declinedProfiles', status: 'Desistiu' }
            ];

            let allCandidates = [];

            for (const { path, status } of collectionsToQuery) {
                const collPath = `artifacts/${appId}/public/data/${path}`;
                const q = query(collection(db, collPath), where("jobId", "==", job.id));
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach((doc) => {
                    allCandidates.push({ ...doc.data(), finalStatus: status, id: doc.id });
                });
            }

            setFullHistory(allCandidates);
            setLoading(false);
        };

        fetchHistory();
    }, [job.id, job.status]);


    const handleSaveRecruiterInfo = async (recruiterName, workedPositions) => {
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
            const jobDocRef = doc(db, `artifacts/${appId}/public/data/jobOpenings`, job.id);
            
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where("name", "==", recruiterName));
            const querySnapshot = await getDocs(q);
            let recruiterId = null;
            if (!querySnapshot.empty) {
                recruiterId = querySnapshot.docs[0].id;
            } else {
                console.warn("Recrutador não encontrado com o nome:", recruiterName);
            }

            const updatedJob = { recruiter: recruiterName, recruiterId, workedPositions: Number(workedPositions), status: 'Em andamento' };
            await updateDoc(jobDocRef, updatedJob);

            if (job.hiringManagerId) {
                await createNotification(
                    job.hiringManagerId,
                    `${recruiterName} começou a trabalhar na sua vaga "${job.jobTitle}".`,
                    { jobId: job.id, jobTitle: job.jobTitle }
                );
            }

        } catch (error) {
            console.error("Erro ao salvar informações da recrutadora: ", error);
        }
    };

    const handleAddCandidate = async (candidateData) => {
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
            const candidatesCollectionPath = `artifacts/${appId}/public/data/jobOpenings/${job.id}/candidates`;
            await addDoc(collection(db, candidatesCollectionPath), {
                ...candidateData,
                status: 'Triagem',
                createdAt: new Date().toISOString(),
                jobTitle: job.jobTitle,
                jobValue: job.jobValue,
                jobId: job.id,
                team: job.team,
                costCenter: job.costCenter,
                hiringCompany: job.hiringCompany,
            });
            setShowCandidateForm(false);
        } catch (error) {
            console.error("Erro ao adicionar candidato:", error);
        }
    };

    const FullJobHistoryView = ({ candidates, loading }) => {
        return (
            <div className="mt-6">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center mb-4"><History className="mr-3 text-gray-600" />Histórico Completo da Vaga</h3>
                {loading ? <p>Carregando histórico...</p> : (
                    <div className="space-y-4">
                        {candidates.length > 0 ? (
                            candidates.map(candidate => (
                                <div key={candidate.id} className={`p-4 rounded-lg shadow-sm border ${candidate.finalStatus === 'Contratado' ? 'border-green-400 bg-green-50' : candidate.finalStatus === 'Reprovado' ? 'border-red-400 bg-red-50' : 'border-orange-400 bg-orange-50'}`}>
                                    <h4 className="font-bold text-lg text-gray-800">{candidate.name}</h4>
                                    <p className="text-sm text-gray-600">Fonte: {candidate.source}</p>
                                    <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Status Final:</span> {candidate.finalStatus}</p>
                                    {candidate.rejectionReason && <p className="text-sm text-gray-500 mt-1 italic">Motivo: {candidate.rejectionReason}</p>}
                                </div>
                            ))
                        ) : (
                            <div className="bg-gray-100 p-8 rounded-lg text-center">
                                <p className="text-gray-600">Nenhum registro no histórico para esta vaga.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
                    <ChevronLeft size={20} className="mr-1" /> Voltar para Vagas
                </button>
                <button onClick={() => setShowQuestionsModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    <Wand2 size={16} /> ✨ Gerar Perguntas de Entrevista
                </button>
            </div>

            {job.status === 'Finalizada' ? (
                <FullJobHistoryView candidates={fullHistory} loading={loading} />
            ) : (
                <>
                    <RecruiterSection job={job} onSave={handleSaveRecruiterInfo} isEditing={isEditingRecruiter} setEditing={setIsEditingRecruiter} />
                    {!isEditingRecruiter && (
                        <>
                            <JobOpeningDetails job={job} />
                            <CandidateSection
                                job={job}
                                candidates={candidates}
                                loading={loading}
                                onAddCandidateClick={() => setShowCandidateForm(true)}
                            />
                        </>
                    )}
                </>
            )}

            {showCandidateForm && <CandidateFormModal onSubmit={handleAddCandidate} onClose={() => setShowCandidateForm(false)} />}
            {showQuestionsModal && <InterviewQuestionsModal job={job} onClose={() => setShowQuestionsModal(false)} />}
        </div>
    );
};

const InterviewQuestionsModal = ({ job, onClose }) => {
    const [questions, setQuestions] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const generateQuestions = async () => {
            setLoading(true);
            const prompt = `Gere uma lista de perguntas de entrevista para o cargo de '${job.jobTitle}'. Separe em 'Perguntas Comportamentais' e 'Perguntas Técnicas'. Formate a resposta como um JSON com duas chaves: "behavioral" e "technical", cada uma contendo um array de strings com 5 perguntas cada.`;
            
            try {
                const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
                const payload = { 
                    contents: chatHistory,
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                "behavioral": { "type": "ARRAY", "items": { "type": "STRING" } },
                                "technical": { "type": "ARRAY", "items": { "type": "STRING" } }
                            }
                        }
                    }
                };
                const apiKey = "";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error(`API error: ${response.statusText}`);
                
                const result = await response.json();
                
                if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
                    const parsedJson = JSON.parse(result.candidates[0].content.parts[0].text);
                    setQuestions(parsedJson);
                } else {
                    throw new Error("Formato de resposta inesperado da API.");
                }
            } catch (error) {
                console.error("Erro ao gerar perguntas:", error);
                setQuestions({ error: "Não foi possível gerar as perguntas. Tente novamente." });
            } finally {
                setLoading(false);
            }
        };

        generateQuestions();
    }, [job.jobTitle]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-3xl w-full">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Sugestões de Perguntas para: <span className="text-indigo-600">{job.jobTitle}</span></h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                </div>
                {loading ? (
                    <div className="text-center py-10">
                        <p>Gerando perguntas com IA...</p>
                    </div>
                ) : questions.error ? (
                    <p className="text-red-500">{questions.error}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto">
                        <div>
                            <h3 className="font-bold text-lg mb-3 text-gray-700">Perguntas Comportamentais</h3>
                            <ul className="list-disc list-inside space-y-2 text-gray-600">
                                {questions.behavioral?.map((q, i) => <li key={`b-${i}`}>{q}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-3 text-gray-700">Perguntas Técnicas</h3>
                            <ul className="list-disc list-inside space-y-2 text-gray-600">
                                {questions.technical?.map((q, i) => <li key={`t-${i}`}>{q}</li>)}
                            </ul>
                        </div>
                    </div>
                )}
                 <div className="flex justify-end mt-6">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg">Fechar</button>
                </div>
            </div>
        </div>
    );
};


const JobOpeningDetails = ({ job }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="my-6">
            <button onClick={() => setIsOpen(!isOpen)} className="text-blue-600 font-semibold flex items-center w-full text-left">
                {isOpen ? <ChevronUp size={20} className="mr-2" /> : <ChevronDown size={20} className="mr-2" />}
                Detalhes da Solicitação da Vaga
            </button>
            {isOpen && (
                <div className="mt-4 p-4 border rounded-lg bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-2 bg-white rounded-md border"><p className="font-semibold text-gray-500">Responsável pela Abertura</p><p className="text-gray-800">{job.hiringManager}</p></div>
                    <div className="p-2 bg-white rounded-md border"><p className="font-semibold text-gray-500">Empresa Contratante</p><p className="text-gray-800">{job.hiringCompany}</p></div>
                    <div className="p-2 bg-white rounded-md border"><p className="font-semibold text-gray-500">Centro de Custo</p><p className="text-gray-800">{job.costCenter}</p></div>
                    <div className="p-2 bg-white rounded-md border"><p className="font-semibold text-gray-500">Valor (Salário)</p><p className="text-gray-800">{job.jobValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                    <div className="md:col-span-2 p-2 bg-white rounded-md border">
                        <p className="font-semibold text-gray-500">Descrição da Vaga</p>
                        <p className="text-gray-800 whitespace-pre-wrap mt-1">{job.jobDescription || 'Nenhuma descrição fornecida.'}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const RecruiterSection = ({ job, onSave, isEditing, setEditing }) => {
    const [recruiterName, setRecruiterName] = useState(job.recruiter || '');
    const [workedPositions, setWorkedPositions] = useState(job.workedPositions || 1);

    const handleSave = () => {
        if (!recruiterName || workedPositions < 1) {
            alert("Preencha as informações da recrutadora.");
            return;
        }
        onSave(recruiterName, workedPositions);
        setEditing(false);
    };

    return (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mb-8">
            <h3 className="text-xl font-bold text-blue-800 mb-4">Informações do Recrutamento</h3>
            {isEditing ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-gray-700 font-semibold mb-1" htmlFor="recruiterName">Nome da Recrutadora Responsável</label>
                        <input type="text" id="recruiterName" value={recruiterName} onChange={e => setRecruiterName(e.target.value)} className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-semibold mb-1" htmlFor="workedPositions">Vagas a serem trabalhadas</label>
                        <input type="number" id="workedPositions" value={workedPositions} onChange={e => setWorkedPositions(e.target.value)} min="1" max={job.positions} className="w-full md:w-1/4 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Salvar e Iniciar Recrutamento
                    </button>
                </div>
            ) : (
                <div className="flex justify-between items-center">
                    <div>
                        <p><span className="font-semibold">Recrutadora:</span> {job.recruiter}</p>
                        <p><span className="font-semibold">Vagas em trabalho:</span> {job.workedPositions} de {job.positions}</p>
                    </div>
                    <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline text-sm">Editar</button>
                </div>
            )}
        </div>
    );
};

const CandidateSection = ({ job, candidates, loading, onAddCandidateClick }) => (
    <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-gray-800 flex items-center"><UserCheck className="mr-3 text-green-600" />Candidatos em Processo</h3>
            <button onClick={onAddCandidateClick} className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors">
                <Plus size={20} className="mr-2" /> Adicionar Candidato
            </button>
        </div>
        {loading ? <p>Carregando candidatos...</p> : (
            <div className="space-y-4">
                {candidates.length > 0 ? (
                    candidates.map(candidate => <CandidateCard key={candidate.id} candidate={candidate} job={job} />)
                ) : (
                    <div className="bg-gray-100 p-8 rounded-lg text-center">
                        <p className="text-gray-600">Nenhum candidato adicionado a esta vaga ainda.</p>
                    </div>
                )}
            </div>
        )}
    </div>
);

const CandidateFormModal = ({ onSubmit, onClose }) => {
    const [name, setName] = useState('');
    const [source, setSource] = useState('');
    const [notes, setNotes] = useState('');
    const [contactNumber, setContactNumber] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !source) {
            alert("Nome e fonte são obrigatórios.");
            return;
        }
        onSubmit({ name, source, notes, contactNumber });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-lg w-full">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Adicionar Novo Candidato</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2" htmlFor="name">Nome Completo</label>
                        <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2" htmlFor="contactNumber">Número de Contato</label>
                        <input type="tel" id="contactNumber" value={contactNumber} onChange={e => setContactNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2" htmlFor="source">Fonte da Candidatura</label>
                        <input type="text" id="source" value={source} onChange={e => setSource(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: LinkedIn, Indicação..." required />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2" htmlFor="notes">Observações Iniciais</label>
                        <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows="4" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>
                    <div className="flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors">Cancelar</button>
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">Salvar Candidato</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CandidateCard = ({ candidate, job }) => {
    const [status, setStatus] = useState(candidate.status);
    const [interviewDate, setInterviewDate] = useState(candidate.interviewDate || '');
    const [rejectionReason, setRejectionReason] = useState(candidate.rejectionReason || '');

    const getStatusStyle = (s) => {
        if (s.includes('Reagendamento')) return 'border-yellow-400 bg-yellow-100';
        switch (s) {
            case 'Entrevista com Recrutador': return 'border-yellow-400 bg-yellow-50';
            case 'Entrevista com Gestor': return 'border-orange-400 bg-orange-50';
            case 'Aprovado': return 'border-green-400 bg-green-50';
            case 'Reprovado': return 'border-red-400 bg-red-50';
            default: return 'border-gray-300 bg-white';
        }
    };

    const handleStatusChange = async (newStatus) => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        setStatus(newStatus);
        const candidateDocRef = doc(db, `artifacts/${appId}/public/data/jobOpenings/${job.id}/candidates/${candidate.id}`);

        if (newStatus === 'Aprovado') {
            try {
                await runTransaction(db, async (transaction) => {
                    const jobDocRef = doc(db, `artifacts/${appId}/public/data/jobOpenings`, job.id);
                    const jobDoc = await transaction.get(jobDocRef);
                    if (!jobDoc.exists()) throw "Vaga não encontrada!";

                    const currentApprovedCount = jobDoc.data().approvedCount || 0;
                    const newApprovedCount = currentApprovedCount + 1;
                    const totalPositions = jobDoc.data().positions;

                    let newJobStatus = jobDoc.data().status;
                    if (newApprovedCount >= totalPositions) newJobStatus = 'Finalizada';

                    transaction.update(jobDocRef, {
                        approvedCount: newApprovedCount,
                        status: newJobStatus
                    });
                });

                const batch = writeBatch(db);
                const contractCollectionPath = `artifacts/${appId}/public/data/contracts`;
                const { id, ...candidateData } = candidate;

                batch.set(doc(collection(db, contractCollectionPath)), {
                    ...candidateData,
                    status: 'Aguardando Admissão'
                });
                batch.delete(candidateDocRef);
                await batch.commit();

            } catch (e) {
                console.error("Falha na transação de aprovação: ", e);
            }
            return;
        }

        if (newStatus === 'Reprovado' && rejectionReason) {
            const batch = writeBatch(db);
            const disapprovedCollectionPath = `artifacts/${appId}/public/data/disapprovedProfiles`;
            batch.set(doc(collection(db, disapprovedCollectionPath)), { ...candidate, status: 'Reprovado', rejectionReason });
            batch.delete(candidateDocRef);
            await batch.commit();
            return;
        }

        let updateData = { status: newStatus };
        if (newStatus.includes('Entrevista') || newStatus.includes('Reagendamento')) {
            updateData.interviewDate = interviewDate;
            const jobDocRef = doc(db, `artifacts/${appId}/public/data/jobOpenings`, job.id);
            await updateDoc(jobDocRef, { status: newStatus });
        }
        await updateDoc(candidateDocRef, updateData);
    };

    return (
        <div className={`p-4 rounded-lg border-l-4 shadow-sm transition-colors ${getStatusStyle(status)}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-lg text-gray-800">{candidate.name}</h4>
                    <p className="text-sm text-gray-600">Fonte: {candidate.source}</p>
                    {candidate.notes && <p className="text-sm text-gray-500 mt-2 italic">"{candidate.notes}"</p>}
                </div>
                <div className="w-52">
                    <select value={status} onChange={(e) => handleStatusChange(e.target.value)} className="w-full p-1 border border-gray-300 rounded-md text-sm">
                        <option>Triagem</option>
                        <option>Entrevista com Recrutador</option>
                        <option>Reagendamento com Recrutador</option>
                        <option>Entrevista com Gestor</option>
                        <option>Reagendamento com Gestor</option>
                        <option>Aprovado</option>
                        <option>Reprovado</option>
                    </select>
                </div>
            </div>
            {(status.includes('Entrevista') || status.includes('Reagendamento')) && (
                <div className="mt-2">
                    <label className="text-sm font-semibold text-gray-700 mr-2">Data da Entrevista:</label>
                    <input type="date" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} onBlur={() => handleStatusChange(status)} className="p-1 border rounded-md text-sm" />
                </div>
            )}
            {status === 'Reprovado' && (
                <div className="mt-2">
                    <label className="text-sm font-semibold text-gray-700 mr-2">Motivo da Reprovação:</label>
                    <input type="text" placeholder="Seja breve" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} onBlur={() => handleStatusChange(status)} className="w-full p-1 border rounded-md text-sm" />
                </div>
            )}
        </div>
    );
};

const DisapprovedProfilesPage = () => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const disapprovedCollectionPath = `artifacts/${appId}/public/data/disapprovedProfiles`;
        const q = query(collection(db, disapprovedCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const disapprovedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProfiles(disapprovedData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">Banco de Perfis Reprovados</h1>
            {loading ? <p>Carregando perfis...</p> : (
                <div className="bg-white p-4 rounded-lg shadow-md">
                    {profiles.length > 0 ? (
                        <ul className="space-y-3">
                            {profiles.map(p => (
                                <li key={p.id} className="p-4 border rounded-lg bg-red-50">
                                    <p className="font-bold text-red-800">{p.name}</p>
                                    <p className="text-sm text-gray-600">Aplicou para: {p.jobTitle}</p>
                                    <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Motivo da reprovação:</span> {p.rejectionReason}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8">Nenhum perfil reprovado encontrado.</p>
                    )}
                </div>
            )}
        </div>
    );
};

const DeclinedProfilesPage = () => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const declinedCollectionPath = `artifacts/${appId}/public/data/declinedProfiles`;
        const q = query(collection(db, declinedCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const declinedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProfiles(declinedData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">Perfis que Desistiram</h1>
            {loading ? <p>Carregando perfis...</p> : (
                <div className="bg-white p-4 rounded-lg shadow-md">
                    {profiles.length > 0 ? (
                        <ul className="space-y-3">
                            {profiles.map(p => (
                                <li key={p.id} className="p-4 border rounded-lg bg-orange-50">
                                    <p className="font-bold text-orange-800">{p.name}</p>
                                    <p className="text-sm text-gray-600">Aplicou para: {p.jobTitle}</p>
                                    <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Motivo da desistência:</span> {p.declineReason || 'Não informado'}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8">Nenhum perfil de desistência encontrado.</p>
                    )}
                </div>
            )}
        </div>
    );
};


const FillContractModal = ({ onSave, onClose, profile }) => {
    const [fullName, setFullName] = useState(profile.name || '');
    const [contactNumber, setContactNumber] = useState(profile.contactNumber || '');
    const [admissionDate, setAdmissionDate] = useState('');
    const [documentDeliveryDate, setDocumentDeliveryDate] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!fullName || !contactNumber || !admissionDate || !documentDeliveryDate) {
            alert('Todos os campos são obrigatórios.');
            return;
        }
        onSave({
            name: fullName,
            contactNumber,
            admissionDate,
            documentDeliveryDate,
            jobTitle: profile.jobTitle,
            team: profile.team,
            jobValue: profile.jobValue,
            hiringCompany: profile.hiringCompany,
            costCenter: profile.costCenter,
            source: profile.source,
            notes: profile.notes,
            jobId: profile.jobId,
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-lg w-full">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Preencher Ficha de Admissão</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700" htmlFor="fullName">Nome Completo</label>
                        <input type="text" id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700" htmlFor="contactNumber">Número de Contato</label>
                        <input type="tel" id="contactNumber" value={contactNumber} onChange={e => setContactNumber(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700" htmlFor="admissionDate">Data da Admissão</label>
                        <input type="date" id="admissionDate" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700" htmlFor="documentDeliveryDate">Data da Entrega de Documentos</label>
                        <input type="date" id="documentDeliveryDate" value={documentDeliveryDate} onChange={e => setDocumentDeliveryDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div className="mt-6 flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">Cancelar</button>
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">Confirmar Admissão</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ContractsPage = ({ onSave, onClose, profile }) => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFillContractModal, setShowFillContractModal] = useState(false);
    const [selectedProfileForContract, setSelectedProfileForContract] = useState(null);

    useEffect(() => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const contractsCollectionPath = `artifacts/${appId}/public/data/contracts`;
        const q = query(collection(db, contractsCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProfiles(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleFillContract = (profile) => {
        setSelectedProfileForContract(profile);
        setShowFillContractModal(true);
    };

    const handleSaveContractData = async (contractData) => {
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
            const batch = writeBatch(db);
            const contractDocRef = doc(db, `artifacts/${appId}/public/data/contracts`, selectedProfileForContract.id);
            const collaboratorsCollectionRef = collection(db, `artifacts/${appId}/public/data/collaborators`);
            const { id, ...profileDataWithoutId } = selectedProfileForContract; 

            batch.set(doc(collaboratorsCollectionRef), {
                ...profileDataWithoutId,
                ...contractData,
                status: 'Aguardando Documentação',
            });

            batch.delete(contractDocRef);

            await batch.commit();
            setShowFillContractModal(false);
            setSelectedProfileForContract(null);
        } catch (error) {
            console.error("Erro ao finalizar contratação:", error);
        }
    };

    const filteredProfiles = profiles.filter(profile =>
        profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.team.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">Colaboradores em Processo de Admissão</h1>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar por nome, cargo ou equipe..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {loading ? <p>Carregando perfis...</p> : (
                <div className="bg-white p-4 rounded-lg shadow-md">
                    {filteredProfiles.length > 0 ? (
                        <ul className="space-y-3">
                            {filteredProfiles.map(p => (
                                <li key={p.id} className="p-4 border rounded-lg bg-blue-50 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-blue-800">{p.name}</p>
                                        <p className="text-sm text-gray-600">Cargo: {p.jobTitle} | Equipe: {p.team}</p>
                                        <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Status:</span> {p.status}</p>
                                        <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Valor da Vaga:</span> {p.jobValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Empresa Contratante:</span> {p.hiringCompany}</p>
                                        <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Centro de Custo:</span> {p.costCenter}</p>
                                    </div>
                                    <button
                                        onClick={() => handleFillContract(p)}
                                        className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 flex items-center"
                                    >
                                        <UserPlus size={16} className="mr-1" /> Preencher Ficha
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8">Nenhum perfil em processo de admissão encontrado.</p>
                    )}
                </div>
            )}

            {showFillContractModal && selectedProfileForContract && (
                <FillContractModal
                    onSave={handleSaveContractData}
                    onClose={() => setShowFillContractModal(false)}
                    profile={selectedProfileForContract}
                />
            )}
        </div>
    );
};

const CollaboratorsPage = () => {
    const [collaborators, setCollaborators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedCollaborator, setSelectedCollaborator] = useState(null);

    useEffect(() => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const collaboratorsCollectionPath = `artifacts/${appId}/public/data/collaborators`;
        const q = query(collection(db, collaboratorsCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCollaborators(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleViewDetails = (collaborator) => {
        setSelectedCollaborator(collaborator);
        setShowDetailModal(true);
    };

    const handleCloseDetailModal = () => {
        setShowDetailModal(false);
        setSelectedCollaborator(null);
    };

    const getCollaboratorCardStyle = (status) => {
        switch (status) {
            case 'Aguardando Documentação': return 'bg-yellow-50 border-yellow-200';
            case 'Admissão Reagendada': return 'bg-orange-50 border-orange-200';
            case 'Ativo': return 'bg-green-50 border-green-200';
            case 'Declinou': return 'bg-red-50 border-red-200';
            default: return 'bg-white border-gray-200';
        }
    };

    const filteredCollaborators = collaborators.filter(collaborator =>
        collaborator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collaborator.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collaborator.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (collaborator.status || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">Nossos Colaboradores</h1>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar por nome, cargo, equipe ou status..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {loading ? <p>Carregando colaboradores...</p> : (
                <div className="bg-white p-4 rounded-lg shadow-md">
                    {filteredCollaborators.length > 0 ? (
                        <ul className="space-y-3">
                            {filteredCollaborators.map(c => (
                                <li key={c.id} className={`p-4 border rounded-lg flex justify-between items-center ${getCollaboratorCardStyle(c.status)}`}>
                                    <div>
                                        <p className="font-bold text-gray-800">{c.name}</p>
                                        <p className="text-sm text-gray-600">Cargo: {c.jobTitle} | Equipe: {c.team}</p>
                                        <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Status da Ficha:</span> {c.status}</p>
                                        {c.admissionDate && <p className="text-sm text-gray-700"><span className="font-semibold">Data Admissão:</span> {new Date(c.admissionDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
                                        {c.documentDeliveryDate && <p className="text-sm text-gray-700"><span className="font-semibold">Entrega Documentos:</span> {new Date(c.documentDeliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
                                    </div>
                                    <button onClick={() => handleViewDetails(c)} className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Ver Detalhes</button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8">Nenhum colaborador encontrado.</p>
                    )}
                </div>
            )}
            {showDetailModal && selectedCollaborator && (
                <CollaboratorDetailModal profile={selectedCollaborator} onClose={handleCloseDetailModal} />
            )}
        </div>
    );
};

const CollaboratorDetailModal = ({ profile, onClose }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [currentStatus, setCurrentStatus] = useState(profile.status);
    const [newAdmissionDate, setNewAdmissionDate] = useState(profile.admissionDate || '');
    const [declineReason, setDeclineReason] = useState('');


    useEffect(() => {
        const fetchHistory = async () => {
            setHistoryLoading(true);
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
            const historyCollectionPath = `artifacts/${appId}/public/data/collaborators/${profile.id}/history`;
            const q = query(collection(db, historyCollectionPath), orderBy('timestamp', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHistory(historyData);
                setHistoryLoading(false);
            });
            return () => unsubscribe();
        };
        fetchHistory();
    }, [profile.id]);

    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;
        setCurrentStatus(newStatus);
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const collaboratorDocRef = doc(db, `artifacts/${appId}/public/data/collaborators`, profile.id);

        try {
            if (newStatus === 'Admissão Finalizada') {
                await updateDoc(collaboratorDocRef, { status: 'Ativo' });
                onClose();
            } else if (newStatus !== 'Declinou') {
                await updateDoc(collaboratorDocRef, {
                    status: newStatus,
                    admissionDate: newAdmissionDate
                });
            }
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
        }
    };

    const handleDeclineConfirm = async () => {
        if (!declineReason) {
            alert('Por favor, insira o motivo da desistência.');
            return;
        }
    
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const collaboratorDocRef = doc(db, `artifacts/${appId}/public/data/collaborators`, profile.id);
        const declinedCollectionRef = collection(db, `artifacts/${appId}/public/data/declinedProfiles`);
        
        if (!profile.jobId) {
            console.error("Não foi possível reabrir a vaga: JobID não encontrado no perfil do colaborador.");
        }
    
        const jobDocRef = profile.jobId ? doc(db, `artifacts/${appId}/public/data/jobOpenings`, profile.jobId) : null;
    
        try {
            await runTransaction(db, async (transaction) => {
                if (jobDocRef) {
                    const jobDoc = await transaction.get(jobDocRef);
                    if (jobDoc.exists()) {
                        const currentApprovedCount = jobDoc.data().approvedCount || 0;
                        const newApprovedCount = Math.max(0, currentApprovedCount - 1);
                        transaction.update(jobDocRef, {
                            approvedCount: newApprovedCount,
                            status: 'Vaga Reaberta'
                        });
                    } else {
                        console.error("Vaga original não encontrada para reabrir.");
                    }
                }
    
                transaction.set(doc(declinedCollectionRef), {
                    ...profile,
                    status: 'Declinou',
                    declineReason: declineReason,
                    declinedAt: serverTimestamp()
                });
    
                transaction.delete(collaboratorDocRef);
            });
    
            alert('Colaborador movido para desistências e vaga reaberta com sucesso!');
            onClose();
        } catch (error) {
            console.error("Erro ao processar desistência e reabrir vaga:", error);
            alert('Erro ao processar desistência. Verifique o console.');
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X size={24} /></button>
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-3xl font-bold text-gray-800">{profile.name}</h2>
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg flex items-center hover:bg-gray-300">
                            <MoreVertical size={20} className="mr-2" /> Ações
                        </button>
                        {showMenu && <OtherActionsMenu profile={profile} closeModal={onClose} />}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-gray-700">
                    <div><p><span className="font-semibold">Cargo:</span> {profile.jobTitle}</p></div>
                    <div><p><span className="font-semibold">Equipe:</span> {profile.team}</p></div>
                    <div><p><span className="font-semibold">VP:</span> {profile.vp || 'N/A'}</p></div>
                    <div><p><span className="font-semibold">Empresa Contratante:</span> {profile.hiringCompany}</p></div>
                    <div><p><span className="font-semibold">Data de Admissão:</span> {profile.admissionDate ? new Date(profile.admissionDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</p></div>
                    <div><p><span className="font-semibold">Salário:</span> {profile.jobValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                    <div><p><span className="font-semibold">Centro de Custo:</span> {profile.costCenter}</p></div>
                    <div><p><span className="font-semibold">Contato:</span> {profile.contactNumber}</p></div>
                    <div><p><span className="font-semibold">Entrega Documentos:</span> {profile.documentDeliveryDate ? new Date(profile.documentDeliveryDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</p></div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="statusFicha">Status da Ficha</label>
                    <select
                        id="statusFicha"
                        value={currentStatus}
                        onChange={handleStatusChange}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    >
                        <option value="Aguardando Documentação">Aguardando Documentação</option>
                        <option value="Admissão Reagendada">Admissão Reagendada</option>
                        <option value="Admissão Finalizada">Admissão Finalizada</option>
                        <option value="Declinou">Declinou</option>
                    </select>

                    {currentStatus === 'Admissão Reagendada' && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="newAdmissionDate">Nova Data de Admissão</label>
                            <input
                                type="date"
                                id="newAdmissionDate"
                                value={newAdmissionDate}
                                onChange={(e) => setNewAdmissionDate(e.target.value)}
                                onBlur={() => handleStatusChange({ target: { value: 'Admissão Reagendada' } })}
                                className="w-full p-2 border border-gray-300 rounded-md"
                            />
                        </div>
                    )}

                    {currentStatus === 'Declinou' && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="declineReason">Motivo da Desistência</label>
                            <textarea
                                id="declineReason"
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                rows="3"
                                className="w-full p-2 border border-gray-300 rounded-md"
                                placeholder="Descreva o motivo da desistência"
                            ></textarea>
                            <button
                                onClick={handleDeclineConfirm}
                                className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                            >
                                Confirmar Desistência e Remover
                            </button>
                        </div>
                    )}
                </div>


                <h3 className="text-xl font-bold text-gray-800 mb-4 border-t pt-4">Histórico do Colaborador</h3>
                {historyLoading ? <p>Carregando histórico...</p> : (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {history.length > 0 ? (
                            history.map(item => (
                                <div key={item.id} className="p-3 bg-gray-100 rounded-lg text-sm">
                                    <p className="font-semibold">{item.changeType} em {item.timestamp?.toDate().toLocaleDateString('pt-BR') || 'N/A'}</p>
                                    {item.details?.from && item.details?.to && (
                                        <p className="text-gray-600">
                                            De: {item.details.from.jobTitle} ({item.details.from.team}) para: {item.details.to.jobTitle} ({item.details.to.team})
                                        </p>
                                    )}
                                    {item.details?.terminationDate && (
                                        <p className="text-gray-600">Desligamento em: {new Date(item.details.terminationDate + 'T00:00:00').toLocaleDateString('pt-BR')} - Motivo: {item.details.terminationReason}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 text-sm">Nenhum histórico encontrado para este colaborador.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


const TerminatedCollaboratorsPage = () => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const terminatedCollectionPath = `artifacts/${appId}/public/data/terminatedProfiles`;
        const q = query(collection(db, terminatedCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProfiles(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">Base de Colaboradores Desligados</h1>
            {loading ? <p>Carregando...</p> : (
                <div className="bg-white p-4 rounded-lg shadow-md">
                    {profiles.length > 0 ? (
                        <ul className="space-y-3">
                            {profiles.map(p => (
                                <li key={p.id} className="p-4 border rounded-lg bg-gray-100">
                                    <p className="font-bold text-gray-800">{p.name}</p>
                                    <p className="text-sm text-gray-600">Cargo: {p.jobTitle}</p>
                                    <p className="text-sm text-red-600 mt-1"><span className="font-semibold">Data de Desligamento:</span> {p.terminationDate ? new Date(p.terminationDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</p>
                                    <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Motivo:</span> {p.terminationReason}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8">Nenhum colaborador desligado encontrado.</p>
                    )}
                </div>
            )}
        </div>
    );
};

const OtherActionsMenu = ({ profile, closeModal }) => {
    const [action, setAction] = useState(null);

    const handleTerminate = async (terminationData) => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const batch = writeBatch(db);
        const terminatedCollectionPath = `artifacts/${appId}/public/data/terminatedProfiles`;
        const collaboratorDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'collaborators', profile.id);

        const { id, ...profileData } = profile;
        batch.set(doc(collection(db, terminatedCollectionPath)), {
            ...profileData,
            ...terminationData,
            status: 'Desligado'
        });
        batch.delete(collaboratorDocRef);

        try {
            await batch.commit();
            closeModal();
        } catch (error) {
            console.error("Erro ao desligar colaborador:", error);
        }
    };

    const handleTransfer = async (transferData) => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const collaboratorDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'collaborators', profile.id);
        const historyCollectionRef = collection(collaboratorDocRef, 'history');

        const batch = writeBatch(db);

        const newValues = {
            team: transferData.newTeam,
            vp: transferData.newVp,
            jobTitle: transferData.newJobTitle,
            hiringCompany: transferData.newHiringCompany,
        };

        batch.update(collaboratorDocRef, newValues);

        batch.set(doc(historyCollectionRef), {
            changeType: 'Transferência',
            timestamp: serverTimestamp(),
            details: {
                from: {
                    team: profile.team,
                    vp: profile.vp,
                    jobTitle: profile.jobTitle,
                    hiringCompany: profile.hiringCompany,
                },
                to: newValues,
                transferDate: transferData.transferDate
            }
        });

        try {
            await batch.commit();
            closeModal();
        } catch (error) {
            console.error("Erro ao transferir colaborador:", error);
        }
    };

    if (action === 'terminate') {
        return <TerminationModal onSave={handleTerminate} onClose={closeModal} />;
    }

    if (action === 'transfer') {
        return <TransferModal onSave={handleTransfer} onClose={closeModal} />;
    }

    return (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border">
            <button onClick={() => setAction('terminate')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Desligar Colaborador</button>
            <button onClick={() => setAction('transfer')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Transferir Colaborador</button>
        </div>
    );
};

const TerminationModal = ({ onSave, onClose }) => {
    const [terminationDate, setTerminationDate] = useState('');
    const [terminationReason, setTerminationReason] = useState('');

    const handleSubmit = () => {
        if (!terminationDate || !terminationReason) return;
        onSave({ terminationDate, terminationReason });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-lg w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Desligar Colaborador</h2>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700" htmlFor="terminationDate">Data de Desligamento</label><input type="date" id="terminationDate" value={terminationDate} onChange={e => setTerminationDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700" htmlFor="terminationReason">Motivo</label><textarea id="terminationReason" value={terminationReason} onChange={e => setTerminationReason(e.target.value)} rows="3" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"></textarea></div>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">Cancelar</button>
                    <button onClick={handleSubmit} className="bg-red-600 text-white px-4 py-2 rounded-lg">Confirmar Desligamento</button>
                </div>
            </div>
        </div>
    );
};

const TransferModal = ({ onSave, onClose }) => {
    const [transferData, setTransferData] = useState({
        transferDate: '',
        newTeam: '',
        newVp: '',
        newJobTitle: '',
        newHiringCompany: '',
    });

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setTransferData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = () => {
        onSave(transferData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-lg w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Transferir Colaborador</h2>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700" htmlFor="transferDate">Data da Transferência</label><input type="date" id="transferDate" value={transferData.transferDate} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700" htmlFor="newJobTitle">Novo Cargo</label><input type="text" id="newJobTitle" value={transferData.newJobTitle} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700" htmlFor="newTeam">Nova Equipe</label><input type="text" id="newTeam" value={transferData.newTeam} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700" htmlFor="newVp">Novo VP</label><input type="text" id="newVp" value={transferData.newVp} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700" htmlFor="newHiringCompany">Nova Empresa Contratante</label><input type="text" id="newHiringCompany" value={transferData.newHiringCompany} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">Cancelar</button>
                    <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Confirmar Transferência</button>
                </div>
            </div>
        </div>
    );
};

const DashboardLayout = ({ onSave, onClose, profile }) => {
    const { user, userData, loading } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!userData?.uid) return;
        const q = query(collection(db, 'notifications'), where('targetUserId', '==', userData.uid), where('read', '==', false));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadCount(snapshot.size);
        });
        return unsubscribe;
    }, [userData?.uid]);

    const handleLogout = async () => {
        if (auth) {
            try {
                await signOut(auth);
            } catch (error) {
                console.error("Erro ao fazer logout:", error);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <p className="text-xl text-gray-600">Carregando...</p>
            </div>
        );
    }

    if (!user) {
        return <AuthPage />;
    }

    const Dashboard = () => {
        const [currentPage, setCurrentPage] = useState('dashboard');

        const NavItem = ({ page, label, icon, permission, hasBadge }) => {
            if (permission && !userData?.permissions?.[permission]) {
                return null;
            }
            return (
                <li className="mb-3">
                    <button onClick={() => setCurrentPage(page)} className={`relative flex items-center w-full p-3 rounded-lg transition-colors ${currentPage === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>
                        {icon} {label}
                        {hasBadge && unreadCount > 0 && (
                            <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-red-500"></span>
                        )}
                    </button>
                </li>
            );
        };

        return (
            <div className="flex h-screen bg-gray-100">
                <aside className="w-64 bg-gray-800 text-white p-6 flex flex-col">
                    <div className="flex items-center mb-8">
                        <Briefcase size={32} className="mr-3 text-blue-400" />
                        <h2 className="text-2xl font-bold">Sistema RH</h2>
                    </div>
                    <nav className="flex-grow">
                        <ul>
                            <NavItem page="dashboard" label="Dashboard" icon={<LayoutDashboard size={20} className="mr-3" />} />
                            <NavItem page="notifications" label="Minhas Notificações" icon={<Bell size={20} className="mr-3" />} hasBadge={true} />
                            <NavItem page="recrutamento" label="Recrutamento" icon={<FileText size={20} className="mr-3" />} permission="manage_recruitment" />
                            <NavItem page="contratos" label="Contratações" icon={<IdCard size={20} className="mr-3" />} permission="manage_contracts" />
                            <NavItem page="colaboradores" label="Colaboradores" icon={<Users size={20} className="mr-3" />} permission="view_collaborators" />
                            <NavItem page="reprovados" label="Banco de Talentos" icon={<Archive size={20} className="mr-3" />} permission="view_talent_pool" />
                            <NavItem page="demitidos" label="Desligados" icon={<UserMinus size={20} className="mr-3" />} permission="view_terminated" />
                            <NavItem page="permissoes" label="Permissões" icon={<Shield size={20} className="mr-3" />} permission="manage_permissions" />
                            <NavItem page="auditoria" label="Logs de Auditoria" icon={<BookText size={20} className="mr-3" />} permission="view_audit_logs" />
                            <NavItem page="turnover" label="Turnover" icon={<BarChart3 size={20} className="mr-3" />} permission="view_reports" />
                        </ul>
                    </nav>
                    <div className="border-t border-gray-700 pt-4 mt-4">
                        <p className="text-gray-400 text-sm">Logado como:</p>
                        <div className="flex items-center mt-1">
                            <UserCircle size={24} className="mr-2" />
                            <span className="font-semibold">{userData?.name || user.email}</span>
                        </div>
                        <button onClick={handleLogout} className="flex items-center w-full p-3 mt-4 text-red-400 hover:bg-gray-700 rounded-lg transition-colors">
                            <LogOut size={20} className="mr-3" /> Sair
                        </button>
                    </div>
                </aside>

                <main className="flex-1 p-8 overflow-y-auto">
                    <ErrorBoundary>
                        {(() => {
                            switch (currentPage) {
                                case 'dashboard': return <DashboardHomePage setCurrentPage={setCurrentPage} />;
                                case 'notifications': return <NotificationsPage />;
                                case 'recrutamento': return <JobOpeningsPage />;
                                case 'contratos': return <ContractsPage />;
                                case 'colaboradores': return <CollaboratorsPage />;
                                case 'reprovados': return <DisapprovedProfilesPage />;
                                case 'demitidos': return <TerminatedCollaboratorsPage />;
                                case 'desistencias': return <DeclinedProfilesPage />;
                                case 'permissoes': return <PermissionsPage />;
                                case 'auditoria': return <AuditLogPage />;
                                case 'turnover': return <PlaceholderPage title="Turnover" icon={<BarChart3 size={96} />} />;
                                default: return <DashboardHomePage setCurrentPage={setCurrentPage} />;
                            }
                        })()}
                    </ErrorBoundary>
                </main>
            </div>
        );
    };

    return user ? <Dashboard /> : <AuthPage />;
};


const JobOpeningsPage = ({ onSave, onClose, profile }) => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState('open');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);

    const handleSelectJob = (job) => setSelectedJob(job);
    const handleBackToJobs = () => setSelectedJob(null);

    const handleCreateJob = async (jobData) => {
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
            await addDoc(collection(db, `artifacts/${appId}/public/data/jobOpenings`), {
                ...jobData,
                status: 'Aberta',
                createdAt: serverTimestamp(),
                approvedCount: 0,
            });
            setShowCreateForm(false);
        } catch (error) {
            console.error("Erro ao criar vaga:", error);
        }
    };

    if (selectedJob) {
        return <JobDetailView job={selectedJob} onBack={handleBackToJobs} />;
    }

    if (showCreateForm) {
        return <JobCreationForm onSubmit={handleCreateJob} onCancel={() => setShowCreateForm(false)} />;
    }

    const tabStyle = "px-4 py-2 font-semibold rounded-t-lg transition-colors";
    const activeTabStyle = "bg-white text-blue-600 border-b-2 border-blue-600";
    const inactiveTabStyle = "bg-transparent text-gray-500 hover:text-blue-600";

    return (
        <div>
            <div className="flex justify-between items-center mb-2 border-b">
                <div className="flex">
                    <button onClick={() => setActiveTab('open')} className={`${tabStyle} ${activeTab === 'open' ? activeTabStyle : inactiveTabStyle}`}>
                        Minhas Vagas em Aberto
                    </button>
                    <button onClick={() => setActiveTab('finished')} className={`${tabStyle} ${activeTab === 'finished' ? activeTabStyle : inactiveTabStyle}`}>
                        Vagas Finalizadas
                    </button>
                </div>
                {activeTab === 'open' && (
                    <button onClick={() => setShowCreateForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center">
                        <Plus size={20} className="mr-2" /> Criar Nova Vaga
                    </button>
                )}
            </div>
            <div className="mt-6">
                {activeTab === 'open' ? <OpenJobsList onSelectJob={handleSelectJob} /> : <FinishedJobsList onSelectJob={handleSelectJob} />}
            </div>
        </div>
    );
};

const OpenJobsList = ({ onSelectJob }) => {
    const { userData } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!userData?.uid) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';
        const jobsRef = collection(db, `artifacts/${appId}/public/data/jobOpenings`);

        const q = userData.permissions?.manage_recruitment 
            ? query(jobsRef, where('status', '!=', 'Finalizada'))
            : query(jobsRef, where('status', '!=', 'Finalizada'), where('hiringManagerId', '==', userData.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const statusOrder = ['Vaga Reaberta', 'Aberta', 'Em andamento', 'Entrevista com Recrutador', 'Reagendamento com Recrutador', 'Entrevista com Gestor', 'Reagendamento com Gestor'];
            jobData.sort((a, b) => {
                const statusIndexA = statusOrder.indexOf(a.status);
                const statusIndexB = statusOrder.indexOf(b.status);
        
                if (statusIndexA !== -1 && statusIndexB !== -1 && statusIndexA !== statusIndexB) {
                    return statusIndexA - statusIndexB;
                }
        
                const dateA = a.createdAt?.toDate() || 0;
                const dateB = b.createdAt?.toDate() || 0;
                return dateB - dateA;
            });

            setJobs(jobData);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar vagas abertas:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [userData]);

    const filteredJobs = jobs.filter(job =>
        job.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.team.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar vagas em aberto..."
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {loading ? <p>Carregando vagas...</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredJobs.length > 0 ? (
                        filteredJobs.map(job => (
                            <JobCard key={job.id} job={job} onSelect={() => onSelectJob(job)} />
                        ))
                    ) : (
                        <div className="md:col-span-3 bg-gray-100 p-8 rounded-lg text-center">
                            <p className="text-gray-600">Nenhuma vaga em aberto encontrada para si.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const FinishedJobsList = ({ onSelectJob }) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rh-app';

            try {
                const activeCollaboratorsQuery = query(collection(db, `artifacts/${appId}/public/data/collaborators`), where('status', '==', 'Ativo'));
                const activeCollaboratorsSnapshot = await getDocs(activeCollaboratorsQuery);
                const activeJobIds = new Set(activeCollaboratorsSnapshot.docs.map(doc => doc.data().jobId).filter(id => id));

                if (activeJobIds.size === 0) {
                    setJobs([]);
                    setLoading(false);
                    return;
                }
                
                const jobIdsArray = Array.from(activeJobIds);
                const finishedJobsQuery = query(collection(db, `artifacts/${appId}/public/data/jobOpenings`), where('status', '==', 'Finalizada'), where('__name__', 'in', jobIdsArray.slice(0, 30)));
                const finishedJobsSnapshot = await getDocs(finishedJobsQuery);
                
                const jobData = finishedJobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setJobs(jobData);

            } catch (error) {
                console.error("Erro ao buscar vagas finalizadas:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const filteredJobs = jobs.filter(job =>
        job.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.team.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar vagas finalizadas..."
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {loading ? <p>Carregando vagas finalizadas...</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredJobs.length > 0 ? (
                        filteredJobs.map(job => (
                            <JobCard key={job.id} job={job} onSelect={() => onSelectJob(job)} />
                        ))
                    ) : (
                        <div className="md:col-span-3 bg-gray-100 p-8 rounded-lg text-center">
                            <p className="text-gray-600">Nenhuma vaga finalizada com colaborador ativo encontrada.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, {
                    displayName: name
                });
            }
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                setError('Este endereço de e-mail já está a ser utilizado.');
            } else if (err.code === 'auth/weak-password') {
                setError('A senha deve ter pelo menos 6 caracteres.');
            } else if (err.code === 'auth/invalid-email') {
                setError('O formato do e-mail é inválido.');
            } else {
                setError("Ocorreu um erro. Verifique suas credenciais.");
                console.error(err);
            }
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">{isLogin ? 'Entrar' : 'Registar'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">Nome Completo</label>
                            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" required={!isLogin} />
                        </div>
                    )}
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">Email</label>
                        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" required />
                    </div>
                    <div className="relative">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">Senha</label>
                        <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center pt-6 text-gray-500">
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-xs italic text-center">{error}</p>}
                    <button type="submit" className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        {isLogin ? 'Entrar' : 'Registar'}
                    </button>
                </form>
                <div className="mt-6 text-center">
                    <button onClick={() => setIsLogin(!isLogin)} className="font-bold text-sm text-blue-500 hover:text-blue-800">
                        {isLogin ? 'Não tem uma conta? Registe-se' : 'Já tem uma conta? Faça login'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    return (
        <AuthProvider>
            <DashboardLayout />
        </AuthProvider>
    );
};

export default App;
