"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Download, LogOut, Store, Trash2, UserPlus } from "lucide-react";
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ImageCropper } from "@/components/media/ImageCropper";
import { ContactsEditor } from "@/components/forms/ContactsEditor";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSessionContext } from "@/hooks/use-session-context";
import { useOwnerTerms } from "@/hooks/use-ref";
import { useContacts, useContactMutation, useMyPlan, useUpdateProfile, type Address, type EmailRow, type FamilyMember, type Phone } from "@/hooks/use-me";
import { uploadFile } from "@/lib/upload";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { setActivePartnerId } from "@/lib/api-client";
import type { AddressRow, EmailRow as PanelEmailRow, PhoneRow } from "@/types/api";

const FEATURE_LABEL: Record<string, string> = {
  owner_pets: "Pets cadastrados",
  owner_gallery: "Galeria de fotos e vídeos",
  owner_stories: "Stories",
  owner_storage_mb: "Armazenamento (MB)",
};

export default function ContaPage() {
  const session = useSessionContext();
  const user = session.data?.user;
  const memberships = session.data?.memberships ?? [];

  if (session.isLoading || !user) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <PageHeader title="Minha conta" description="Perfil, contatos, família, privacidade e plano." />
      <ProfileCard />
      <ContactsCard />
      <FamilyCard />
      <ConsentsCard />
      <PlanCard />
      <Card title="Aparência">
        <ThemeToggle withLabel />
      </Card>
      <Card title="Negócios">
        {memberships.length ? (
          <ul className="space-y-2">
            {memberships.map((m) => (
              <li key={m.partnerId} className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{m.partnerName} <Badge>{m.role === "OWNER" ? "Dono" : "Equipe"}</Badge></span>
                <Link href="/painel" onClick={() => setActivePartnerId(m.partnerId)} className="btn-secondary">Abrir painel</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-[var(--muted)]">É treinador, clínica, loja ou pet shop? Crie seu negócio no tinyPet.</p>
        )}
        <Link href="/painel/novo" className="btn-primary mt-3"><Store className="h-4 w-4" aria-hidden /> Sou parceiro / Criar meu negócio</Link>
      </Card>
      <DangerZone />
    </div>
  );
}

function ProfileCard() {
  const { data } = useSessionContext();
  const user = data!.user;
  const terms = useOwnerTerms();
  const update = useUpdateProfile();
  const { toast } = useToast();
  const [name, setName] = useState(user.name);
  const [birthDate, setBirthDate] = useState(user.birthDate?.slice(0, 10) ?? "");
  const [termId, setTermId] = useState(user.ownerTermId ?? "");
  const [cropOpen, setCropOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setName(user.name);
    setTermId(user.ownerTermId ?? "");
  }, [user.name, user.ownerTermId]);

  async function save() {
    try {
      await update.mutateAsync({ name, birthDate: birthDate || null, ownerTermId: termId || null });
      toast("Perfil atualizado", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <Card title="Perfil">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {user.avatarUrl ? <img src={user.avatarUrl} alt="Sua foto" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl font-bold text-[var(--muted)]">{user.name.slice(0, 1)}</div>}
          </div>
          <Button variant="secondary" onClick={() => setCropOpen(true)}>Trocar foto</Button>
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <Input id="name" label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input id="email" label="E-mail de login" value={user.email} disabled />
          <Input id="birth" type="date" label="Data de nascimento (opcional)" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          <Select id="term" label="Como prefere ser chamado" value={termId} onChange={(e) => setTermId(e.target.value)}>
            {(terms.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
          <div className="sm:col-span-2 flex items-center justify-between">
            {user.emailVerified ? <Badge tone="green">E-mail verificado</Badge> : <Link href="/verificar" className="text-sm text-brand-600 underline">Verificar e-mail</Link>}
            <Button onClick={save} loading={update.isPending}>Salvar</Button>
          </div>
        </div>
      </div>
      <Modal open={cropOpen} onClose={() => setCropOpen(false)} title="Foto do perfil">
        <ImageCropper
          file={file}
          onFile={setFile}
          submitting={uploading}
          accept="image/jpeg,image/png,image/webp,image/heic"
          onCancel={() => setCropOpen(false)}
          onConfirm={async (f, crop) => {
            setUploading(true);
            try {
              const media = await uploadFile(f, "USER_AVATAR", { crop, partnerId: null });
              await update.mutateAsync({ avatarUrl: media.url });
              toast("Foto atualizada", "success");
              setCropOpen(false);
              setFile(null);
            } catch (e) {
              toast(errorMessage(e), "error");
            } finally {
              setUploading(false);
            }
          }}
        />
      </Modal>
    </Card>
  );
}

function ContactsCard() {
  const phones = useContacts<Phone>("phones");
  const emails = useContacts<EmailRow>("emails");
  const addresses = useContacts<Address>("addresses");
  if (phones.isLoading || emails.isLoading || addresses.isLoading) return <Card title="Contatos e endereços"><Spinner /></Card>;
  return (
    <Card title="Contatos e endereços">
      <ContactsEditor
        base="/me"
        phones={(phones.data ?? []) as unknown as PhoneRow[]}
        emails={(emails.data ?? []) as unknown as PanelEmailRow[]}
        addresses={(addresses.data ?? []) as unknown as AddressRow[]}
        invalidateKey={["me"]}
      />
    </Card>
  );
}

function FamilyCard() {
  const q = useContacts<FamilyMember>("family");
  const m = useContactMutation("family");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", relationship: "", phone: "", email: "", canAuthorize: false, canPickUp: false });

  async function add() {
    try {
      await m.mutateAsync({ method: "POST", body: { ...form, email: form.email || null, phone: form.phone || null, relationship: form.relationship || null } });
      setOpen(false);
      setForm({ name: "", relationship: "", phone: "", email: "", canAuthorize: false, canPickUp: false });
      toast("Familiar adicionado", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <Card title="Família" actions={<Button variant="secondary" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" aria-hidden /> Adicionar</Button>}>
      {q.isLoading ? <Spinner /> : !(q.data ?? []).length ? (
        <p className="text-sm text-[var(--muted)]">Cadastre quem também cuida dos seus pets. Para dar acesso à ficha, use a aba Família de cada pet.</p>
      ) : (
        <ul className="divide-y">
          {q.data!.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <p className="text-sm font-medium">{f.name}{f.relationship ? ` · ${f.relationship}` : ""}</p>
                <p className="text-xs text-[var(--muted)]">{[f.phone, f.email].filter(Boolean).join(" · ")}</p>
                <div className="mt-1 flex gap-1">
                  {f.canAuthorize && <Badge tone="blue">Autoriza atendimentos</Badge>}
                  {f.canPickUp && <Badge tone="blue">Pode retirar o pet</Badge>}
                </div>
              </div>
              <Button variant="ghost" aria-label={`Remover ${f.name}`} onClick={() => m.mutate({ id: f.id, method: "DELETE" })}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo familiar">
        <div className="space-y-3">
          <Input id="fn" label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input id="fr" label="Parentesco" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
          <Input id="fp" label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input id="fe" label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.canAuthorize} onChange={(e) => setForm({ ...form, canAuthorize: e.target.checked })} /> Pode autorizar atendimentos</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.canPickUp} onChange={(e) => setForm({ ...form, canPickUp: e.target.checked })} /> Pode retirar o pet</label>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={add} loading={m.isPending} disabled={form.name.length < 1}>Adicionar</Button></div>
        </div>
      </Modal>
    </Card>
  );
}

function ConsentsCard() {
  const { data } = useSessionContext();
  const user = data!.user;
  const update = useUpdateProfile();
  const { toast } = useToast();
  const toggle = (key: "marketingConsent" | "publicPhotosConsent" | "statsConsent", value: boolean) =>
    update.mutate({ [key]: value }, { onSuccess: () => toast("Preferência salva", "success"), onError: (e) => toast(errorMessage(e), "error") });
  const items: { key: "marketingConsent" | "publicPhotosConsent" | "statsConsent"; label: string; help: string; value: boolean }[] = [
    { key: "marketingConsent", label: "Receber ofertas e novidades", help: "Indicações de lojas e ofertas das marcas que seus pets usam.", value: user.marketingConsent },
    { key: "publicPhotosConsent", label: "Permitir compartilhar fotos publicamente", help: "Itens da galeria marcados como públicos podem aparecer em páginas de parceiros.", value: !!user.publicPhotosConsent },
    { key: "statsConsent", label: "Usar dados anônimos nas estatísticas", help: "Seus pets entram no comparativo de comandos, sem identificação.", value: user.statsConsent },
  ];
  return (
    <Card title="Privacidade (LGPD)">
      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.key}>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" checked={i.value} onChange={(e) => toggle(i.key, e.target.checked)} />
              <span><span className="block text-sm font-medium">{i.label}</span><span className="block text-xs text-[var(--muted)]">{i.help}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--muted)]">Leia os <Link href="/termos" className="underline">termos de uso</Link> e a <Link href="/privacidade" className="underline">política de privacidade</Link>.</p>
    </Card>
  );
}

function PlanCard() {
  const q = useMyPlan();
  if (q.isLoading) return <Card title="Plano"><Spinner /></Card>;
  if (!q.data) return <Card title="Plano"><Empty title="Não foi possível carregar o plano" /></Card>;
  const { planKey, limits, usage } = q.data;
  return (
    <Card title={`Plano ${planKey === "owner_plus" ? "Plus" : "Free"}`}>
      <ul className="space-y-2">
        {Object.entries(FEATURE_LABEL).map(([key, label]) => {
          const l = limits[key];
          if (!l) return null;
          const used = usage[key];
          return (
            <li key={key} className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <span className="text-[var(--muted)]">
                {!l.enabled ? "Não incluso" : l.quantity == null ? (used != null ? `${used} · ilimitado` : "Incluso") : used != null ? `${used} de ${l.quantity}` : `até ${l.quantity}`}
              </span>
            </li>
          );
        })}
      </ul>
      {planKey !== "owner_plus" && <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-100">Galeria e stories fazem parte do plano Plus, que chega em breve.</p>}
    </Card>
  );
}

function DangerZone() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportData() {
    try {
      const data = await api<unknown>("/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tinypet-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await api("/auth/me", { method: "DELETE" });
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      toast(errorMessage(e), "error");
      setBusy(false);
    }
  }

  return (
    <Card title="Seus dados">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={exportData}><Download className="h-4 w-4" aria-hidden /> Baixar meus dados</Button>
        <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/" })}><LogOut className="h-4 w-4" aria-hidden /> Sair</Button>
        <Button variant="danger" onClick={() => setStep(1)}><Trash2 className="h-4 w-4" aria-hidden /> Excluir conta</Button>
      </div>
      <Modal open={step > 0} onClose={() => setStep(0)} title="Excluir conta">
        {step === 1 ? (
          <div className="space-y-3 text-sm">
            <p>Sua conta, contatos e pets serão removidos. Parceiros que precisam guardar prontuários ficam só com dados anonimizados.</p>
            <p>Contratos e parcelas com parceiros continuam valendo fora do app.</p>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setStep(0)}>Cancelar</Button><Button variant="danger" onClick={() => setStep(2)}>Continuar</Button></div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p>Esta ação não pode ser desfeita. Digite <strong>EXCLUIR</strong> para confirmar.</p>
            <Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Confirmação" />
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setStep(0)}>Cancelar</Button><Button variant="danger" loading={busy} disabled={confirmText !== "EXCLUIR"} onClick={deleteAccount}>Excluir definitivamente</Button></div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
