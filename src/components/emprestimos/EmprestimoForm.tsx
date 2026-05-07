'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { DateInput } from '@/components/ui/date-input'
import { InputMoeda } from '@/components/ui/input-moeda'
import { InputPorcentagem } from '@/components/ui/input-porcentagem'
import { Loader2, AlertCircle } from 'lucide-react'
import { gerarParcelas, calcularJurosMensal } from '@/utils/juros'
import { formatCurrency } from '@/utils/currency'
import { formatDate, monthsBetween } from '@/utils/date'
import type { Tomador } from '@/types'

const schema = z.object({
  tomador_id: z.string().uuid('Selecione um tomador'),
  valor_principal: z.coerce.number().positive('Valor deve ser positivo'),
  taxa_juros_mensal: z.coerce.number().min(0).max(1),
  data_inicio: z.string().min(1, 'Informe a data de início'),
  data_vencimento: z.string().min(1, 'Informe a data de vencimento'),
  modalidade: z.enum(['juros_mensais', 'sem_juros', 'parcelado']),
  descricao: z.string().optional(),
  garantia: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface EmprestimoFormProps {
  tomadores: Tomador[]
  onSubmit: (values: FormValues) => Promise<void>
  isLoading?: boolean
}

export function EmprestimoForm({ tomadores, onSubmit, isLoading }: EmprestimoFormProps) {
  const [previewParcelas, setPreviewParcelas] = useState<ReturnType<typeof gerarParcelas>>([])

  const { control, register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      modalidade: 'juros_mensais',
      taxa_juros_mensal: 0.05,
      data_inicio: new Date().toISOString().split('T')[0],
      valor_principal: 0,
    },
  })

  const watchedValues = watch()

  useEffect(() => {
    const { valor_principal, taxa_juros_mensal, data_inicio, data_vencimento, modalidade } = watchedValues
    if (valor_principal && data_inicio && data_vencimento && data_inicio < data_vencimento) {
      setPreviewParcelas(gerarParcelas(Number(valor_principal), Number(taxa_juros_mensal), data_inicio, data_vencimento, modalidade))
    } else {
      setPreviewParcelas([])
    }
  }, [watchedValues.valor_principal, watchedValues.taxa_juros_mensal, watchedValues.data_inicio, watchedValues.data_vencimento, watchedValues.modalidade])

  function handleTomadorChange(id: string) {
    setValue('tomador_id', id)
    const tomador = tomadores.find(t => t.id === id)
    if (tomador?.eh_familiar) {
      setValue('modalidade', 'sem_juros')
      setValue('taxa_juros_mensal', 0)
    }
  }

  const meses = watchedValues.data_inicio && watchedValues.data_vencimento
    ? monthsBetween(watchedValues.data_inicio, watchedValues.data_vencimento)
    : 0

  const jurosMensal = watchedValues.valor_principal && watchedValues.taxa_juros_mensal
    ? calcularJurosMensal(Number(watchedValues.valor_principal), Number(watchedValues.taxa_juros_mensal))
    : 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Tomador */}
      <div className="space-y-2">
        <Label>Tomador *</Label>
        <Controller
          name="tomador_id"
          control={control}
          render={({ field }) => (
            <Combobox
              options={tomadores.map(t => ({
                value: t.id,
                label: t.nome,
                badge: t.eh_familiar ? 'familiar' : undefined,
              }))}
              value={field.value ?? ''}
              onChange={handleTomadorChange}
              placeholder="Buscar tomador..."
            />
          )}
        />
        {errors.tomador_id && <p className="text-xs text-destructive">{errors.tomador_id.message}</p>}
      </div>

      {/* Valor e modalidade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor principal *</Label>
          <Controller
            name="valor_principal"
            control={control}
            render={({ field }) => (
              <InputMoeda value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
          {errors.valor_principal && <p className="text-xs text-destructive">{errors.valor_principal.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Modalidade *</Label>
          <Controller
            name="modalidade"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  if (v === 'sem_juros') setValue('taxa_juros_mensal', 0)
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="juros_mensais">Juros mensais</SelectItem>
                  <SelectItem value="sem_juros">Sem juros (lump sum)</SelectItem>
                  <SelectItem value="parcelado">Parcelado (parcelas fixas)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* Taxa de juros */}
      {(watchedValues.modalidade === 'juros_mensais' || watchedValues.modalidade === 'parcelado') && (
        <div className="space-y-2">
          <Label>Taxa de juros mensal *</Label>
          <Controller
            name="taxa_juros_mensal"
            control={control}
            render={({ field }) => (
              <InputPorcentagem value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
          {jurosMensal > 0 && watchedValues.valor_principal > 0 && (
            <p className="text-xs text-muted-foreground">
              = {formatCurrency(jurosMensal)} por mês
            </p>
          )}
        </div>
      )}

      {/* Datas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data_inicio">Data de início *</Label>
          <DateInput id="data_inicio" {...register('data_inicio')} />
          {errors.data_inicio && <p className="text-xs text-destructive">{errors.data_inicio.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_vencimento">Data de vencimento *</Label>
          <DateInput id="data_vencimento" {...register('data_vencimento')} />
          {errors.data_vencimento && <p className="text-xs text-destructive">{errors.data_vencimento.message}</p>}
          {meses > 0 && <p className="text-xs text-muted-foreground">{meses} {meses === 1 ? 'mês' : 'meses'}</p>}
        </div>
      </div>

      {/* Descrição e garantia */}
      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição / finalidade</Label>
        <Input id="descricao" placeholder="Ex: Pagamento de dívida, reforma..." {...register('descricao')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="garantia">Garantia</Label>
        <Input id="garantia" placeholder="Ex: Cheque pré-datado, nota promissória..." {...register('garantia')} />
      </div>

      {/* Preview de parcelas */}
      {previewParcelas.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4 text-primary" />
            Parcelas que serão geradas ({previewParcelas.length})
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {previewParcelas.map((p) => (
              <div key={p.numero} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">
                  #{p.numero} — {p.tipo === 'juros' ? 'Juros' : 'Principal'} — {formatDate(p.data_vencimento)}
                </span>
                <span className={p.tipo === 'principal' ? 'font-semibold text-primary' : ''}>
                  {p.status === 'isento' ? 'Isento' : formatCurrency(p.valor_esperado)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-medium pt-1">
            <span>Total esperado</span>
            <span className="text-primary">
              {formatCurrency(previewParcelas.reduce((s, p) => s + (p.status === 'isento' ? 0 : p.valor_esperado), 0))}
            </span>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Criar empréstimo
      </Button>
    </form>
  )
}
