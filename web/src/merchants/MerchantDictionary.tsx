import { useState } from 'react'
import { CategoryPicker } from '@/categories/CategoryPicker'
import type { Category } from '@/categories/types'
import { ListSkeleton } from '@/components/LoadingSkeletons'
import { useToast } from '@/components/Toast'
import { Input } from '@/components/ui/input'
import { strings } from '@/strings'
import { merchantLabel } from './merchantLabel'
import type { MerchantEntry, MerchantsApi } from './merchantsApi'

const s = strings.categories.dictionary
const norm = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// The merchant -> category dictionary. Changing a category here only changes what the NEXT purchases
// of that merchant get; purchases already loaded are not touched.
export function MerchantDictionary({
  merchants,
  status,
  error,
  categories,
  api,
  onError,
}: {
  merchants: MerchantEntry[]
  status: 'loading' | 'ready' | 'error'
  error: string | null
  categories: Category[]
  api: MerchantsApi
  onError: () => void
}) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const shown = merchants.filter((m) => norm(m.merchant).includes(norm(query.trim())))

  return (
    <div className="grid gap-3">
      {status === 'loading' && <ListSkeleton rows={4} />}
      {status === 'error' && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {status === 'ready' && merchants.length === 0 && <p className="text-muted-foreground">{s.empty}</p>}
      {status === 'ready' && merchants.length > 0 && (
        <>
          <Input value={query} placeholder={s.search} aria-label={s.search} onChange={(e) => setQuery(e.target.value)} />
          {shown.length === 0 ? (
            <p className="text-muted-foreground">{s.noMatch}</p>
          ) : (
            <ul className="grid max-h-96 gap-2 overflow-y-auto">
              {shown.map((m) => (
                <li key={m.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <span className="min-w-0 flex-1 truncate">{merchantLabel(m.merchant)}</span>
                  <CategoryPicker
                    categories={categories}
                    categoryId={m.categoryId}
                    merchant={m.merchant}
                    allowNone={false}
                    ariaLabel={s.changeAria(merchantLabel(m.merchant))}
                    onChange={(categoryId) => categoryId && void api.remember(m.merchant, categoryId).then(() => toast(strings.saved)).catch(onError)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
