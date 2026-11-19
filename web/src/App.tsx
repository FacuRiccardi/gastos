import { BarChart3Icon, CreditCardIcon, HomeIcon, LogOutIcon, PiggyBankIcon, ReceiptTextIcon, TagsIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/auth/AuthProvider'
import type { AuthApi, AuthUser } from '@/auth/authApi'
import { LoginScreen } from '@/auth/LoginScreen'
import { NoAccessScreen } from '@/auth/NoAccessScreen'
import { CardsTab } from '@/cards/CardsTab'
import { CategoriesTab } from '@/categories/CategoriesTab'
import { ToastProvider, useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { PageSkeleton } from '@/components/LoadingSkeletons'
import { BalanceTab } from '@/balance/BalanceTab'
import type { BudgetSection } from '@/budget/BudgetScreen'
import { BudgetTab } from '@/budget/BudgetTab'
import { HomeTab } from '@/home/HomeTab'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ExpensesTab } from '@/expenses/ExpensesTab'
import { NavTab, ScrollableTabsList } from '@/expenses/ScrollableTabsList'
import type { Backend } from '@/data/backend'
import { DataProvider } from '@/data/DataProvider'
import { DataStore } from '@/data/dataStore'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'

type AppProps = {
  authApi: AuthApi
  createBackend: () => Backend
}

export default function App({ authApi, createBackend }: AppProps) {
  return (
    <AuthProvider api={authApi}>
      <ToastProvider>
      <Screens createBackend={createBackend} />
      </ToastProvider>
    </AuthProvider>
  )
}

function Screens({ createBackend }: Pick<AppProps, 'createBackend'>) {
  const { state, error, signIn, signOut, recheck } = useAuth()

  switch (state.status) {
    case 'loading':
      return (
        <div className="mx-auto max-w-3xl p-4">
          <PageSkeleton />
        </div>
      )
    case 'signedOut':
      return <LoginScreen onSignIn={() => void signIn()} error={error} />
    case 'unauthorized':
      return <NoAccessScreen onCheckAgain={() => void recheck()} onSignOut={() => void signOut()} error={error} />
    case 'authorized':
      // Only this branch creates the backend, so nothing is read before authorization.
      return <Authorized user={state.user} createBackend={createBackend} onSignOut={() => void signOut()} />
  }
}

function Authorized({ user, createBackend, onSignOut }: Pick<AppProps, 'createBackend'> & { user: AuthUser; onSignOut: () => void }) {
  const [store] = useState(() => new DataStore(createBackend()))
  useEffect(() => {
    void store.loadConfig()
    void store.loadUncategorized()
  }, [store])
  // The tab is controlled so the alerts of the home view can take you to the right one.
  const [tab, setTab] = useState<string>('home')
  // The card to open when an alert of the home view takes you to another tab (cleared when you change tab by hand).
  const [openSection, setOpenSection] = useState<string | null>(null)
  const goTo = (target: 'toCategorize' | 'fixed' | 'money' | 'cards') => {
    if (target === 'toCategorize') {
      setTab('categories')
      setOpenSection('toCategorize')
    } else if (target === 'cards') {
      setTab('cards')
      setOpenSection(null)
    } else {
      setTab('budget')
      setOpenSection(target)
    }
  }
  const toast = useToast()
  const [categorySaveFailed, setCategorySaveFailed] = useState(false)
  const saveCategory = (save: Promise<void>) => {
    setCategorySaveFailed(false)
    save.then(() => toast(strings.saved)).catch(() => setCategorySaveFailed(true))
  }
  // From "Compras a categorizar": also remember the choice for the merchant and apply it to its other pending purchases.
  const categorize = (expense: Expense, categoryId: string | null) => saveCategory(store.categorize(expense, categoryId))
  const changeCategory = (expense: Expense, categoryId: string | null) => saveCategory(store.categoriesApi.setExpenseCategory(expense, categoryId))

  return (
    <DataProvider store={store}>
    <div className="mx-auto min-w-0 max-w-3xl p-4 max-sm:pb-24">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-lg font-semibold">{strings.appName}</h1>
        <div className="flex shrink-0 items-center gap-2">
          {user.photoURL && <img src={user.photoURL} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />}
          <span className="hidden text-sm text-muted-foreground sm:inline">{user.displayName ?? user.email}</span>
          <Button variant="ghost" size="sm" className="max-sm:min-w-11" onClick={onSignOut}>
            <LogOutIcon className="sm:hidden" aria-hidden />
            <span className="max-sm:sr-only">{strings.header.signOut}</span>
          </Button>
        </div>
      </header>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(String(value))
          setOpenSection(null)
        }}
      >
        {/* On a phone the tabs are a bar at the bottom; wider screens get a strip that scrolls sideways, with arrows. */}
        <ScrollableTabsList>
          <NavTab value="home" icon={HomeIcon}>{strings.tabs.home}</NavTab>
          <NavTab value="expenses" icon={ReceiptTextIcon}>{strings.tabs.expenses}</NavTab>
          <NavTab value="cards" icon={CreditCardIcon}>{strings.tabs.cards}</NavTab>
          <NavTab value="categories" icon={TagsIcon}>{strings.tabs.categories}</NavTab>
          <NavTab value="budget" icon={PiggyBankIcon}>{strings.tabs.budget}</NavTab>
          <NavTab value="balance" icon={BarChart3Icon}>{strings.tabs.balance}</NavTab>
        </ScrollableTabsList>
        <TabsContent value="home">
          {categorySaveFailed && (
            <p role="alert" className="mb-3 rounded-md border border-destructive p-3 text-destructive">
              {strings.categories.saveError}
            </p>
          )}
          <HomeTab onCategoryChange={changeCategory} onNavigate={goTo} />
        </TabsContent>
        <TabsContent value="expenses">
          {categorySaveFailed && (
            <p role="alert" className="mb-3 rounded-md border border-destructive p-3 text-destructive">
              {strings.categories.saveError}
            </p>
          )}
          <ExpensesTab onCategoryChange={changeCategory} />
        </TabsContent>
        <TabsContent value="cards">
          <CardsTab />
        </TabsContent>
        <TabsContent value="categories">
          {categorySaveFailed && (
            <p role="alert" className="mb-3 rounded-md border border-destructive p-3 text-destructive">
              {strings.categories.saveError}
            </p>
          )}
          <CategoriesTab onCategorize={categorize} initialOpen={openSection === 'toCategorize' ? 'toCategorize' : null} />
        </TabsContent>
        <TabsContent value="budget">
          <BudgetTab initialOpen={(openSection as BudgetSection | null) ?? null} />
        </TabsContent>
        <TabsContent value="balance">
          <BalanceTab />
        </TabsContent>
      </Tabs>
    </div>
    </DataProvider>
  )
}
