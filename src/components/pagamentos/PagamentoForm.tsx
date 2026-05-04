'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'
import { today } from '@/utils/date'
import type { Parcela } from '@/types'

const schema = z.object({
  valor_pago: z.coerce.number().positive('Informe o valor pago'),
  data_pagamento: z.string().min(1, 'Informe a data'),
  forma_pagamento: z.enum(['pix', 'dinheiro', 'transferencia', 'cheque']),
  observacoes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface PagamentoFormProps {
  parcela: Parcela
  onSubmit: (values: FormValues) => Promise<void>
  isLoading?: boolean
}

export function PagamentoForm({ parcela, onSubmit, isLoading }: PagamentoFormProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      valor_pago: parcela.valor_esperado,
      data_pagamento: today(),
      forma_pagamento: 'pix',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="p-3 rounded-lg bg-secondary/50 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Parcela</span>
          <span>#{parcela.numero} — {parcela.tipo === 'juros' ? 'Juros' : 'Principal'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor esperado</span>
          <span className="font-medium">{formatCurrency(parcela.valor_esperado)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="valor_pago">Valor pago (R$) *</Label>
        <Input
          id="valor_pago"
          type="number"
          step="0.01"
          min="0.01"
          {...register('valor_pago')}
        />
        {errors.valor_pago && <p className="text-xs text-destructive">{errors.valor_pago.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="data_pagamento">Data do pagamento *</Label>
        <Input id="data_pagamento" type="date" {...register('data_pagamento')} />
        {errors.data_pagamento && <p className="text-xs text-destructive">{errors.data_pagamento.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Forma de pagamento *</Label>
        <Select
          defaultValue="pix"
          onValueChange={(v) => setValue('forma_pagamento', v as FormValues['forma_pagamento'])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="transferencia">Transferência</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" placeholder="Opcional..." {...register('observacoes')} />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Registrar pagamento
      </Button>
    </form>
  )
}
