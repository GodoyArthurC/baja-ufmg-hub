import { useEffect, useState, useRef } from 'react';
import { supabase } from './lib/supabase';
import { 
  Bell, Calendar, AlertTriangle, Plus, MapPin, Clock, X, Filter, 
  CheckCircle2, XCircle, LogOut, User as UserIcon, Users,
  Pencil, Trash2, Repeat, ChevronDown, FileText,
  ExternalLink, Upload, Loader2
} from 'lucide-react';

interface Subsistema {
  id: string;
  nome: string;
  cor_hex: string;
}

interface PerfilMembro {
  id: string;
  nome_completo: string;
  apelido?: string;
}

interface Aviso {
  id: string;
  titulo: string;
  conteudo: string;
  urgente: boolean;
  subsistema_id?: string | null;
  autor_id?: string | null;
  anexo_url?: string | null;
  criado_em: string;
}

interface Presenca {
  id: string;
  reuniao_id: string;
  usuario_id: string;
  status: 'Confirmado' | 'Recusado';
  justificativa?: string;
  perfis?: {
    nome_completo: string;
    apelido?: string;
  };
}

interface Reuniao {
  id: string;
  titulo: string;
  tema?: string | null;
  local: string;
  data_horario: string;
  subsistema_id?: string | null;
  organizador_id?: string | null;
  presencas?: Presenca[];
}

export default function App() {
  const [sessao, setSessao] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Autenticação por CPF
  const [authCpf, setAuthCpf] = useState('');
  const [authSenha, setAuthSenha] = useState('');
  const [authErro, setAuthErro] = useState('');

  // Dados Gerais
  const [subsistemas, setSubsistemas] = useState<Subsistema[]>([]);
  const [membros, setMembros] = useState<PerfilMembro[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [filtroSubsistema, setFiltroSubsistema] = useState<string>('todos');

  // Mapeamento de Ocorrência Selecionada para Grupos de Sprints
  const [sprintSelecionadaMap, setSprintSelecionadaMap] = useState<Record<string, string>>({});

  // Modais de Criação e Edição
  const [modalAvisoAberto, setModalAvisoAberto] = useState(false);
  const [avisoEmEdicao, setAvisoEmEdicao] = useState<Aviso | null>(null);

  const [modalReuniaoAberto, setModalReuniaoAberto] = useState(false);
  const [reuniaoEmEdicao, setReuniaoEmEdicao] = useState<Reuniao | null>(null);

  // Modais de Presença e Justificativa
  const [modalJustificativa, setModalJustificativa] = useState<{ reuniaoId: string } | null>(null);
  const [textoJustificativa, setTextoJustificativa] = useState('');
  const [reuniaoVerPresencas, setReuniaoVerPresencas] = useState<Reuniao | null>(null);

  // Campos - Aviso
  const [novoAvisoTitulo, setNovoAvisoTitulo] = useState('');
  const [novoAvisoConteudo, setNovoAvisoConteudo] = useState('');
  const [novoAvisoUrgente, setNovoAvisoUrgente] = useState(false);
  const [novoAvisoSubsistema, setNovoAvisoSubsistema] = useState('');
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [anexoAtualUrl, setAnexoAtualUrl] = useState<string | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Campos - Reunião
  const [novaReuniaoTitulo, setNovaReuniaoTitulo] = useState('');
  const [novaReuniaoTema, setNovaReuniaoTema] = useState('');
  const [novaReuniaoLocal, setNovaReuniaoLocal] = useState('');
  const [novaReuniaoData, setNovaReuniaoData] = useState('');
  const [novaReuniaoSubsistema, setNovaReuniaoSubsistema] = useState('');

  // Sprints Semanais (Recorrência)
  const [reuniaoRecorrente, setReuniaoRecorrente] = useState(false);
  const [semanasRecorrencia, setSemanasRecorrencia] = useState(4);

  // Carregar Sessão
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      if (session?.user) carregarPerfil(session.user.id);
      setCarregandoSessao(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
      if (session?.user) carregarPerfil(session.user.id);
      else setPerfil(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function carregarPerfil(userId: string) {
    const { data } = await supabase.from('perfis').select('*').eq('id', userId).single();
    if (data) setPerfil(data);
  }

  // Carregar Dados do Banco
  async function carregarDados() {
    const [subRes, perfisRes, avisosRes, reunioesRes, presencasRes] = await Promise.all([
      supabase.from('subsistemas').select('*').order('nome'),
      supabase.from('perfis').select('id, nome_completo, apelido'),
      supabase.from('avisos').select('*').order('criado_em', { ascending: false }),
      supabase.from('reunioes').select('*').order('data_horario', { ascending: true }),
      supabase.from('presencas_reuniao').select('*, perfis(nome_completo, apelido)')
    ]);

    if (subRes.data) setSubsistemas(subRes.data);
    if (perfisRes.data) setMembros(perfisRes.data);
    if (avisosRes.data) setAvisos(avisosRes.data);

    if (reunioesRes.data) {
      const reunioesComPresencas = reunioesRes.data.map((r: any) => ({
        ...r,
        presencas: presencasRes.data ? presencasRes.data.filter((p: any) => p.reuniao_id === r.id) : []
      }));
      setReunioes(reunioesComPresencas);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [sessao]);

  // Identificação do Subsistema do Usuário
  const subsistemaUsuario = subsistemas.find((s) => s.id === perfil?.subsistema_id);
  const ehGestao = subsistemaUsuario?.nome.toLowerCase() === 'gestão';

  // Permissões
  const ehSuperAdminOuNA = 
    sessao?.user?.email === 'godoyarthurc@gmail.com' || 
    perfil?.cargo === 'NA';

  const podeGerenciarGeral = ehSuperAdminOuNA || ehGestao;

  function podeGerenciarItem(subsistemaIdItem?: string | null) {
    if (ehSuperAdminOuNA || ehGestao) return true;
    if (perfil?.cargo === 'Chefe' || perfil?.cargo === 'Gerente') {
      return perfil.subsistema_id === subsistemaIdItem;
    }
    return false;
  }

  function getNomeAutor(usuarioId?: string | null) {
    if (!usuarioId) return 'Liderança';
    const membro = membros.find((m) => m.id === usuarioId);
    return membro?.apelido || membro?.nome_completo || 'Membro da equipe';
  }

  // Máscara e Tratamento de CPF
  function formatarMascaraCPF(valor: string) {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 11);
    return apenasNumeros
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  // Autenticação com Mapeamento CPF -> E-mail Interno
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthErro('');

    const cpfLimpo = authCpf.replace(/\D/g, '');

    if (cpfLimpo.length !== 11) {
      setAuthErro('Informe um CPF válido com 11 dígitos.');
      return;
    }

    const emailMapeado = `${cpfLimpo}@baja.local`;

    const { error } = await supabase.auth.signInWithPassword({
      email: emailMapeado,
      password: authSenha
    });

    if (error) {
      setAuthErro(
        error.message === 'Invalid login credentials'
          ? 'CPF ou senha incorretos. Contate o NA.'
          : error.message
      );
    }
  }

  // Presença
  async function registrarPresenca(reuniaoId: string, status: 'Confirmado' | 'Recusado', justificativa = '') {
    if (!sessao?.user) return;

    const { error } = await supabase.from('presencas_reuniao').upsert({
      reuniao_id: reuniaoId,
      usuario_id: sessao.user.id,
      status,
      justificativa: justificativa || null,
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'reuniao_id,usuario_id' });

    if (error) {
      alert('Erro ao registrar presença: ' + error.message);
    } else {
      setModalJustificativa(null);
      setTextoJustificativa('');
      carregarDados();
    }
  }

  // Avisos
  function abrirModalAviso(avisoParaEditar?: Aviso) {
    setArquivoSelecionado(null);
    if (avisoParaEditar) {
      setAvisoEmEdicao(avisoParaEditar);
      setNovoAvisoTitulo(avisoParaEditar.titulo);
      setNovoAvisoConteudo(avisoParaEditar.conteudo);
      setNovoAvisoUrgente(avisoParaEditar.urgente);
      setNovoAvisoSubsistema(avisoParaEditar.subsistema_id || '');
      setAnexoAtualUrl(avisoParaEditar.anexo_url || null);
    } else {
      setAvisoEmEdicao(null);
      setNovoAvisoTitulo('');
      setNovoAvisoConteudo('');
      setNovoAvisoUrgente(false);
      setNovoAvisoSubsistema(!podeGerenciarGeral && perfil?.subsistema_id ? perfil.subsistema_id : '');
      setAnexoAtualUrl(null);
    }
    setModalAvisoAberto(true);
  }

  async function uploadArquivoStorage(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop();
    const nomeLimpo = file.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
    const caminho = `${Date.now()}_${nomeLimpo}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('anexos')
      .upload(caminho, file);

    if (uploadError) {
      alert('Erro ao enviar anexo: ' + uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('anexos').getPublicUrl(caminho);
    return data.publicUrl;
  }

  async function handleSalvarAviso(e: React.FormEvent) {
    e.preventDefault();
    if (!novoAvisoTitulo || !novoAvisoConteudo) return;

    setEnviandoArquivo(true);
    let urlFinal = anexoAtualUrl;

    if (arquivoSelecionado) {
      const urlEnviada = await uploadArquivoStorage(arquivoSelecionado);
      if (urlEnviada) urlFinal = urlEnviada;
    }

    const payload = {
      titulo: novoAvisoTitulo,
      conteudo: novoAvisoConteudo,
      urgente: novoAvisoUrgente,
      subsistema_id: novoAvisoSubsistema === '' ? null : novoAvisoSubsistema,
      anexo_url: urlFinal
    };

    if (avisoEmEdicao) {
      const { data, error } = await supabase
        .from('avisos')
        .update(payload)
        .eq('id', avisoEmEdicao.id)
        .select();

      setEnviandoArquivo(false);

      if (error || !data || data.length === 0) {
        alert('Acesso negado ou erro ao salvar alteração.');
        return;
      }

      setAvisos((prev) =>
        prev.map((a) => (a.id === avisoEmEdicao.id ? { ...a, ...payload } : a))
      );
    } else {
      const { error } = await supabase
        .from('avisos')
        .insert([{ ...payload, autor_id: sessao?.user?.id || null }]);

      setEnviandoArquivo(false);

      if (error) {
        alert('Erro ao criar aviso: ' + error.message);
        return;
      }
      carregarDados();
    }

    setModalAvisoAberto(false);
    setAvisoEmEdicao(null);
    setArquivoSelecionado(null);
  }

  async function handleExcluirAviso(id: string) {
    if (!confirm('Deseja realmente excluir este aviso?')) return;
    const { error } = await supabase.from('avisos').delete().eq('id', id);
    if (!error) {
      setAvisos((prev) => prev.filter((a) => a.id !== id));
    } else {
      alert('Erro ao excluir: ' + error.message);
    }
  }

  // Reuniões
  function abrirModalReuniao(reuniaoParaEditar?: Reuniao) {
    if (reuniaoParaEditar) {
      setReuniaoEmEdicao(reuniaoParaEditar);
      setNovaReuniaoTitulo(reuniaoParaEditar.titulo);
      setNovaReuniaoTema(reuniaoParaEditar.tema || '');
      setNovaReuniaoLocal(reuniaoParaEditar.local);
      const d = new Date(reuniaoParaEditar.data_horario);
      const dataFormatada = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setNovaReuniaoData(dataFormatada);
      setNovaReuniaoSubsistema(reuniaoParaEditar.subsistema_id || '');
    } else {
      setReuniaoEmEdicao(null);
      setNovaReuniaoTitulo('');
      setNovaReuniaoTema('');
      setNovaReuniaoLocal('');
      setNovaReuniaoData('');
      setNovaReuniaoSubsistema(!podeGerenciarGeral && perfil?.subsistema_id ? perfil.subsistema_id : '');
      setReuniaoRecorrente(false);
      setSemanasRecorrencia(4);
    }
    setModalReuniaoAberto(true);
  }

  async function handleSalvarReuniao(e: React.FormEvent) {
    e.preventDefault();
    if (!novaReuniaoTitulo || !novaReuniaoLocal || !novaReuniaoData) return;

    const subId = novaReuniaoSubsistema === '' ? null : novaReuniaoSubsistema;

    if (reuniaoEmEdicao) {
      const payload = {
        titulo: novaReuniaoTitulo,
        tema: novaReuniaoTema || null,
        local: novaReuniaoLocal,
        data_horario: new Date(novaReuniaoData).toISOString(),
        subsistema_id: subId,
      };

      const { data, error } = await supabase
        .from('reunioes')
        .update(payload)
        .eq('id', reuniaoEmEdicao.id)
        .select();

      if (error || !data || data.length === 0) {
        alert('Acesso negado ou erro ao salvar alteração.');
        return;
      }

      setReunioes((prev) =>
        prev.map((r) => (r.id === reuniaoEmEdicao.id ? { ...r, ...payload } : r))
      );
    } else {
      const dataBase = new Date(novaReuniaoData);
      const totalOcorrencias = reuniaoRecorrente ? Math.min(Math.max(semanasRecorrencia, 1), 16) : 1;
      const novasReunioes = [];

      for (let i = 0; i < totalOcorrencias; i++) {
        const dataOcorrencia = new Date(dataBase);
        dataOcorrencia.setDate(dataOcorrencia.getDate() + i * 7);

        novasReunioes.push({
          titulo: novaReuniaoTitulo,
          tema: novaReuniaoTema || null,
          local: novaReuniaoLocal,
          data_horario: dataOcorrencia.toISOString(),
          subsistema_id: subId,
          organizador_id: sessao?.user?.id || null,
        });
      }

      const { error } = await supabase.from('reunioes').insert(novasReunioes);

      if (error) {
        alert('Erro ao agendar reunião: ' + error.message);
        return;
      }
      carregarDados();
    }

    setModalReuniaoAberto(false);
    setReuniaoEmEdicao(null);
    setReuniaoRecorrente(false);
  }

  async function handleExcluirReuniao(id: string) {
    if (!confirm('Deseja realmente cancelar e excluir esta ocorrência de reunião?')) return;
    const { error } = await supabase.from('reunioes').delete().eq('id', id);
    if (!error) {
      setReunioes((prev) => prev.filter((r) => r.id !== id));
      if (reuniaoVerPresencas?.id === id) {
        setReuniaoVerPresencas(null);
      }
    } else {
      alert('Erro ao excluir: ' + error.message);
    }
  }

  function getSubsistemaInfo(subId?: string | null) {
    if (!subId) return { nome: 'Geral / Todos', cor_hex: '#64748B' };
    const encontrado = subsistemas.find((s) => s.id === subId);
    return encontrado || { nome: 'Geral / Todos', cor_hex: '#64748B' };
  }

  function formatarData(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatarDiaHora(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function ehImagem(url: string) {
    return /\.(jpeg|jpg|png|webp|gif|svg)$/i.test(url);
  }

  // Isolamento Estrito: Gestão, NA e Admin veem todos os avisos
  const avisosFiltrados = avisos.filter((aviso) => {
    if (!ehSuperAdminOuNA && !ehGestao && aviso.subsistema_id && aviso.subsistema_id !== perfil?.subsistema_id) {
      return false;
    }
    if (filtroSubsistema === 'todos') return true;
    if (filtroSubsistema === 'geral') return !aviso.subsistema_id;
    return aviso.subsistema_id === filtroSubsistema || !aviso.subsistema_id;
  });

  // Isolamento Estrito: Gestão, NA e Admin veem todas as reuniões
  const reunioesPermitidas = reunioes.filter((reuniao) => {
    if (!ehSuperAdminOuNA && !ehGestao && reuniao.subsistema_id && reuniao.subsistema_id !== perfil?.subsistema_id) {
      return false;
    }
    if (filtroSubsistema === 'todos') return true;
    if (filtroSubsistema === 'geral') return !reuniao.subsistema_id;
    return reuniao.subsistema_id === filtroSubsistema || !reuniao.subsistema_id;
  });

  // Agrupamento Inteligente
  const gruposDeReuniao: { chave: string; ocorrencias: Reuniao[] }[] = [];
  reunioesPermitidas.forEach((r) => {
    const chave = `${r.subsistema_id || 'geral'}_${r.titulo.trim().toLowerCase()}`;
    const grupoExistente = gruposDeReuniao.find((g) => g.chave === chave);
    if (grupoExistente) {
      grupoExistente.ocorrencias.push(r);
    } else {
      gruposDeReuniao.push({ chave, ocorrencias: [r] });
    }
  });

  if (carregandoSessao) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400 text-sm">
        Carregando Hub Baja...
      </div>
    );
  }

  // TELA DE LOGIN POR CPF
  if (!sessao) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
        <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">BAJA UFMG • Hub</h1>
            <p className="text-xs text-neutral-400 mt-1">Acesso exclusivo para membros da equipe</p>
          </div>

          {authErro && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg mb-4">
              {authErro}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">CPF</label>
              <input
                type="text"
                required
                maxLength={14}
                value={authCpf}
                onChange={(e) => setAuthCpf(formatarMascaraCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Senha</label>
              <input
                type="password"
                required
                value={authSenha}
                onChange={(e) => setAuthSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2.5 rounded-lg transition"
            >
              Entrar
            </button>
          </form>

          <p className="text-[11px] text-neutral-500 text-center mt-5">
            Primeiro acesso ou alteração cadastral? Procure o NA.
          </p>
        </div>
      </div>
    );
  }

  // TELA PRINCIPAL
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8 font-sans">
      <header className="max-w-5xl mx-auto mb-6 border-b border-neutral-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">BAJA UFMG • Hub</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
            <UserIcon size={12} />
            <span>{perfil?.nome_completo || formatarMascaraCPF(sessao.user.email?.replace('@baja.local', '') || '')}</span>
            <span className="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded text-[10px] font-medium border border-neutral-700">
              {ehSuperAdminOuNA ? 'Admin (NA)' : perfil?.cargo || 'Membro'}
            </span>
            {perfil?.subsistema_id && (
              <span className="text-neutral-500 text-[11px]">
                • {subsistemas.find(s => s.id === perfil.subsistema_id)?.nome}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-full text-xs text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Online
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sair da Conta"
            className="p-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-700 transition"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Barra de Filtros - Gestão e NA veem todas as áreas */}
      <section className="max-w-5xl mx-auto mb-6">
        <div className="flex items-center gap-2 mb-2 text-xs text-neutral-400 font-medium">
          <Filter size={14} /> Filtrar área:
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroSubsistema('todos')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${
              filtroSubsistema === 'todos'
                ? 'bg-neutral-100 text-neutral-950 border-white font-semibold'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Tudo
          </button>
          <button
            onClick={() => setFiltroSubsistema('geral')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${
              filtroSubsistema === 'geral'
                ? 'bg-neutral-100 text-neutral-950 border-white font-semibold'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Apenas Geral
          </button>
          {subsistemas
            .filter((sub) => ehSuperAdminOuNA || ehGestao || sub.id === perfil?.subsistema_id)
            .map((sub) => {
              const ativo = filtroSubsistema === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setFiltroSubsistema(sub.id)}
                  style={{
                    borderColor: ativo ? sub.cor_hex : `${sub.cor_hex}40`,
                    backgroundColor: ativo ? `${sub.cor_hex}30` : 'transparent'
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    ativo ? 'text-white font-semibold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {sub.nome}
                </button>
              );
            })}
        </div>
      </section>

      {/* Painéis */}
      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Painel de Avisos */}
        <section className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Bell size={20} />
              <h2 className="text-lg font-semibold text-white">Mural de Avisos</h2>
            </div>
            {(ehSuperAdminOuNA || ehGestao || perfil?.cargo === 'Chefe' || perfil?.cargo === 'Gerente') && (
              <button
                onClick={() => abrirModalAviso()}
                className="flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs px-3 py-1.5 rounded-lg border border-neutral-700 transition"
              >
                <Plus size={14} /> Novo Aviso
              </button>
            )}
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
            {avisosFiltrados.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-8">Nenhum aviso nesta categoria.</p>
            ) : (
              avisosFiltrados.map((aviso) => {
                const sub = getSubsistemaInfo(aviso.subsistema_id);
                const podeEditar = podeGerenciarItem(aviso.subsistema_id);
                const autorNome = getNomeAutor(aviso.autor_id);

                return (
                  <div
                    key={aviso.id}
                    className={`p-4 rounded-xl border ${
                      aviso.urgente
                        ? 'bg-red-500/10 border-red-500/40'
                        : 'bg-neutral-900/80 border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          style={{ borderColor: `${sub.cor_hex}60`, backgroundColor: `${sub.cor_hex}20` }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded border text-neutral-200"
                        >
                          {sub.nome}
                        </span>
                        {aviso.urgente && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded">
                            <AlertTriangle size={12} /> Urgente
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          Por <strong className="text-neutral-300">{autorNome}</strong> • {formatarData(aviso.criado_em)}
                        </span>
                        {podeEditar && (
                          <div className="flex items-center gap-1 border-l border-neutral-800 pl-2">
                            <button
                              onClick={() => abrirModalAviso(aviso)}
                              title="Editar Aviso"
                              className="p-1 text-neutral-400 hover:text-white rounded"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleExcluirAviso(aviso.id)}
                              title="Excluir Aviso"
                              className="p-1 text-neutral-400 hover:text-red-400 rounded"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <h3 className="text-sm font-semibold text-white">{aviso.titulo}</h3>
                    <p className="text-xs text-neutral-300 mt-2 whitespace-pre-wrap">{aviso.conteudo}</p>

                    {/* Exibição Visual de Anexos */}
                    {aviso.anexo_url && (
                      <div className="mt-3 pt-2.5 border-t border-neutral-800/60">
                        {ehImagem(aviso.anexo_url) ? (
                          <a
                            href={aviso.anexo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg border border-neutral-800 hover:border-neutral-700 transition max-h-56 group"
                          >
                            <img
                              src={aviso.anexo_url}
                              alt="Anexo"
                              className="w-full h-auto object-cover group-hover:scale-105 transition duration-300"
                            />
                          </a>
                        ) : (
                          <a
                            href={aviso.anexo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-red-400 hover:text-red-300 hover:border-red-500/40 transition group"
                          >
                            <FileText size={14} className="text-red-400 group-hover:scale-110 transition" />
                            <span className="font-medium text-white">Visualizar Documento (PDF)</span>
                            <ExternalLink size={11} className="text-neutral-500 group-hover:text-red-300" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Painel de Reuniões Condensado */}
        <section className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-blue-400">
              <Calendar size={20} />
              <h2 className="text-lg font-semibold text-white">Próximas Reuniões</h2>
            </div>
            {(ehSuperAdminOuNA || ehGestao || perfil?.cargo === 'Chefe' || perfil?.cargo === 'Gerente') && (
              <button
                onClick={() => abrirModalReuniao()}
                className="flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs px-3 py-1.5 rounded-lg border border-neutral-700 transition"
              >
                <Plus size={14} /> Agendar
              </button>
            )}
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px]">
            {gruposDeReuniao.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-8">Nenhuma reunião nesta categoria.</p>
            ) : (
              gruposDeReuniao.map((grupo) => {
                const idAtivo = sprintSelecionadaMap[grupo.chave] || grupo.ocorrencias[0].id;
                const reuniao = grupo.ocorrencias.find((o) => o.id === idAtivo) || grupo.ocorrencias[0];

                const sub = getSubsistemaInfo(reuniao.subsistema_id);
                const podeEditar = podeGerenciarItem(reuniao.subsistema_id);
                const minhaPresenca = reuniao.presencas?.find((p) => p.usuario_id === sessao.user.id);
                const confirmados = reuniao.presencas?.filter((p) => p.status === 'Confirmado') || [];
                const recusados = reuniao.presencas?.filter((p) => p.status === 'Recusado') || [];
                const ehRecorrente = grupo.ocorrencias.length > 1;
                const organizadorNome = getNomeAutor(reuniao.organizador_id);

                return (
                  <div key={grupo.chave} className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-3">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            style={{ borderColor: `${sub.cor_hex}60`, backgroundColor: `${sub.cor_hex}20` }}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded border text-neutral-200"
                          >
                            {sub.nome}
                          </span>
                          {ehRecorrente && (
                            <span className="flex items-center gap-1 text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                              <Repeat size={10} /> Sprint Semanal
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!ehRecorrente ? (
                            <span className="text-xs font-medium text-blue-400 flex items-center gap-1 shrink-0">
                              <Clock size={12} /> {formatarData(reuniao.data_horario)}
                            </span>
                          ) : (
                            <div className="relative">
                              <select
                                value={reuniao.id}
                                onChange={(e) =>
                                  setSprintSelecionadaMap((prev) => ({
                                    ...prev,
                                    [grupo.chave]: e.target.value
                                  }))
                                }
                                className="appearance-none bg-neutral-950 border border-neutral-800 text-blue-400 hover:border-neutral-700 text-xs font-medium py-1 pl-2 pr-6 rounded-lg focus:outline-none cursor-pointer"
                              >
                                {grupo.ocorrencias.map((oc, idx) => (
                                  <option key={oc.id} value={oc.id}>
                                    {formatarDiaHora(oc.data_horario)} {idx === 0 ? '(Próxima)' : ''}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={12} className="absolute right-2 top-2 text-neutral-500 pointer-events-none" />
                            </div>
                          )}

                          {podeEditar && (
                            <div className="flex items-center gap-1 border-l border-neutral-800 pl-2">
                              <button
                                onClick={() => abrirModalReuniao(reuniao)}
                                title="Editar esta data"
                                className="p-1 text-neutral-400 hover:text-white rounded"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleExcluirReuniao(reuniao.id)}
                                title="Excluir esta data"
                                className="p-1 text-neutral-400 hover:text-red-400 rounded"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-white mt-1">{reuniao.titulo}</h3>
                      {reuniao.tema && (
                        <p className="text-xs text-neutral-400 mt-1 italic">{reuniao.tema}</p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400 mt-2">
                        <div className="flex items-center gap-1">
                          <MapPin size={13} className="text-neutral-500 shrink-0" />
                          <span>{reuniao.local}</span>
                        </div>
                        <span className="text-neutral-600">•</span>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                          <span>Agendado por: <strong className="text-neutral-300">{organizadorNome}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Barra de RSVP */}
                    <div className="pt-2 border-t border-neutral-800/80">
                      <div className="text-[11px] text-neutral-400 mb-2 font-medium flex justify-between items-center">
                        <span>Sua presença em {new Date(reuniao.data_horario).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}:</span>
                        <span className="font-semibold text-neutral-300">
                          {minhaPresenca ? minhaPresenca.status : 'Não respondido'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => registrarPresenca(reuniao.id, 'Confirmado')}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium border transition ${
                            minhaPresenca?.status === 'Confirmado'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-emerald-400'
                          }`}
                        >
                          <CheckCircle2 size={13} /> Vou
                        </button>

                        <button
                          onClick={() => setModalJustificativa({ reuniaoId: reuniao.id })}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium border transition ${
                            minhaPresenca?.status === 'Recusado'
                              ? 'bg-red-500/20 text-red-300 border-red-500/50'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-red-400'
                          }`}
                        >
                          <XCircle size={13} /> Não vou
                        </button>
                      </div>
                    </div>

                    {/* Resumo de Participantes */}
                    <div className="pt-2 border-t border-neutral-800/50 text-[11px] text-neutral-400 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Users size={12} className="text-neutral-500" />
                        <span>Confirmados: <strong className="text-emerald-400">{confirmados.length}</strong></span>
                        {recusados.length > 0 && (
                          <span className="ml-2">Ausências: <strong className="text-red-400">{recusados.length}</strong></span>
                        )}
                      </div>

                      {podeEditar && (
                        <button
                          onClick={() => setReuniaoVerPresencas(reuniao)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2 ml-2 shrink-0"
                        >
                          Ver Lista ({reuniao.presencas?.length || 0})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* Modal Justificativa */}
      {modalJustificativa && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-1">
              Justificar Ausência
            </h3>
            <p className="text-xs text-neutral-400 mb-3">
              Informe à liderança o motivo pelo qual não poderá comparecer:
            </p>
            <textarea
              rows={3}
              required
              placeholder="Ex: Aula de Cálculo / Estágio..."
              value={textoJustificativa}
              onChange={(e) => setTextoJustificativa(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalJustificativa(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                onClick={() => registrarPresenca(modalJustificativa.reuniaoId, 'Recusado', textoJustificativa)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Avisos */}
      {modalAvisoAberto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white">
                {avisoEmEdicao ? 'Editar Aviso' : 'Publicar Novo Aviso'}
              </h3>
              <button onClick={() => setModalAvisoAberto(false)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSalvarAviso} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Público-alvo / Subsistema</label>
                <select
                  disabled={!podeGerenciarGeral}
                  value={novoAvisoSubsistema}
                  onChange={(e) => setNovoAvisoSubsistema(e.target.value)}
                  className={`w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 ${
                    !podeGerenciarGeral ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {podeGerenciarGeral && <option value="">Geral / Todos (Toda a equipe)</option>}
                  {subsistemas
                    .filter((s) => podeGerenciarGeral || s.id === perfil?.subsistema_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                </select>
                {!podeGerenciarGeral && (
                  <p className="text-[10px] text-neutral-500 mt-1">Como Chefe/Gerente, os avisos são restritos ao seu subsistema.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Título</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Entrega do relatório técnico"
                  value={novoAvisoTitulo}
                  onChange={(e) => setNovoAvisoTitulo(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Conteúdo</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Escreva a mensagem..."
                  value={novoAvisoConteudo}
                  onChange={(e) => setNovoAvisoConteudo(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Upload de Anexo */}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Anexo (Foto ou PDF)</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setArquivoSelecionado(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-300 transition"
                  >
                    <Upload size={13} /> Escolher arquivo
                  </button>

                  <span className="text-xs text-neutral-400 truncate max-w-[200px]">
                    {arquivoSelecionado ? arquivoSelecionado.name : anexoAtualUrl ? 'Arquivo já anexado' : 'Nenhum selecionado'}
                  </span>

                  {(arquivoSelecionado || anexoAtualUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        setArquivoSelecionado(null);
                        setAnexoAtualUrl(null);
                      }}
                      className="p-1 text-neutral-500 hover:text-red-400 transition"
                      title="Remover anexo"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgente"
                  checked={novoAvisoUrgente}
                  onChange={(e) => setNovoAvisoUrgente(e.target.checked)}
                  className="rounded border-neutral-700 text-red-600 focus:ring-0"
                />
                <label htmlFor="urgente" className="text-xs text-neutral-300">Marcar como urgente</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={enviandoArquivo}
                  onClick={() => setModalAvisoAberto(false)}
                  className="px-4 py-2 text-xs text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoArquivo}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-neutral-950 font-semibold rounded-lg text-xs transition"
                >
                  {enviandoArquivo && <Loader2 size={13} className="animate-spin" />}
                  {avisoEmEdicao ? 'Salvar Alterações' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reuniões */}
      {modalReuniaoAberto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white">
                {reuniaoEmEdicao ? 'Editar Reunião' : 'Agendar Reunião Presencial'}
              </h3>
              <button onClick={() => setModalReuniaoAberto(false)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSalvarReuniao} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Subsistema / Área</label>
                <select
                  disabled={!podeGerenciarGeral}
                  value={novaReuniaoSubsistema}
                  onChange={(e) => setNovaReuniaoSubsistema(e.target.value)}
                  className={`w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 ${
                    !podeGerenciarGeral ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {podeGerenciarGeral && <option value="">Geral / Todos (Toda a equipe)</option>}
                  {subsistemas
                    .filter((s) => podeGerenciarGeral || s.id === perfil?.subsistema_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                </select>
                {!podeGerenciarGeral && (
                  <p className="text-[10px] text-neutral-500 mt-1">Como Chefe/Gerente, as reuniões são restritas ao seu subsistema.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Título</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sprint Semanal"
                  value={novaReuniaoTitulo}
                  onChange={(e) => setNovaReuniaoTitulo(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Pauta (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Dimensionamento do câmbio"
                  value={novaReuniaoTema}
                  onChange={(e) => setNovaReuniaoTema(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Local Físico</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Oficina - Bancada / Sala 204"
                  value={novaReuniaoLocal}
                  onChange={(e) => setNovaReuniaoLocal(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Data e Hora (1ª Reunião)</label>
                <input
                  type="datetime-local"
                  required
                  value={novaReuniaoData}
                  onChange={(e) => setNovaReuniaoData(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {!reuniaoEmEdicao && (
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="recorrente"
                      checked={reuniaoRecorrente}
                      onChange={(e) => setReuniaoRecorrente(e.target.checked)}
                      className="rounded border-neutral-700 text-blue-600 focus:ring-0"
                    />
                    <label htmlFor="recorrente" className="text-xs text-neutral-300 font-medium flex items-center gap-1.5 cursor-pointer">
                      <Repeat size={13} className="text-blue-400" /> Repetir semanalmente (Sprint fixa)
                    </label>
                  </div>

                  {reuniaoRecorrente && (
                    <div className="flex items-center justify-between pl-6 pt-1">
                      <span className="text-[11px] text-neutral-400">Repetir por:</span>
                      <select
                        value={semanasRecorrencia}
                        onChange={(e) => setSemanasRecorrencia(Number(e.target.value))}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value={4}>4 semanas (1 mês)</option>
                        <option value={8}>8 semanas (2 meses)</option>
                        <option value={12}>12 semanas (3 meses)</option>
                        <option value={16}>16 semanas (Semestre)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalReuniaoAberto(false)}
                  className="px-4 py-2 text-xs text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition"
                >
                  {reuniaoEmEdicao ? 'Salvar Alterações' : 'Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lista de Presenças */}
      {reuniaoVerPresencas && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-start mb-4 border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Lista de Chamada & Respostas</h3>
                <p className="text-xs text-neutral-400 mt-0.5">{reuniaoVerPresencas.titulo} • {formatarData(reuniaoVerPresencas.data_horario)}</p>
              </div>
              <button
                onClick={() => setReuniaoVerPresencas(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {(!reuniaoVerPresencas.presencas || reuniaoVerPresencas.presencas.length === 0) ? (
                <p className="text-xs text-neutral-500 text-center py-6">Nenhum membro respondeu a esta reunião ainda.</p>
              ) : (
                reuniaoVerPresencas.presencas.map((p) => (
                  <div key={p.id} className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-white">
                        {p.perfis?.nome_completo || 'Membro da Equipe'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'Confirmado'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {p.status}
                      </span>
                    </div>

                    {p.justificativa && (
                      <div className="mt-2 p-2 bg-neutral-900 border border-neutral-800 rounded text-neutral-300 italic text-[11px]">
                        "{p.justificativa}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}