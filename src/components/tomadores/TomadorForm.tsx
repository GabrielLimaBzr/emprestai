'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import type { Tomador } from '@/types'

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  telefone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cpf: z.string().optional(),
  eh_familiar: z.boolean().default(false),
  observacoes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface TomadorFormProps {
  defaultValues?: Partial<Tomador>
  onSubmit: (values: FormValues) => Promise<void>
  isLoading?: boolean
}

export function TomadorForm({ defaultValues, onSubmit, isLoading }: TomadorFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: defaultValues?.nome ?? '',
      telefone: defaultValues?.telefone ?? '',
      email: defaultValues?.email ?? '',
      cpf: defaultValues?.cpf ?? '',
      eh_familiar: defaultValues?.eh_familiar ?? false,
      observacoes: defaultValues?.observacoes ?? '',
    },
  })

  const ehFamiliar = watch('eh_familiar')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome *</Label>
        <Input id="nome" placeholder="Nome completo" {...register('nome')} />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" placeholder="(11) 99999-9999" {...register('telefone')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpf">CPF</Label>
          <Input id="cpf" placeholder="000.000.000-00" {...register('cpf')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="email@exemplo.com" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
        <Switch
          id="eh_familiar"
          checked={ehFamiliar}
          onCheckedChange={(v) => setValue('eh_familiar', v)}
        />
        <div>
          <Label htmlFor="eh_familiar" className="cursor-pointer">É familiar</Label>
          <p className="text-xs text-muted-foreground">Empréstimos familiares podem ter taxa 0%</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" placeholder="Informações adicionais..." {...register('observacoes')} />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {defaultValues ? 'Salvar alterações' : 'Cadastrar tomador'}
      </Button>
    </form>
  )
}
