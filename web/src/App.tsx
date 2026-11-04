import { useState } from 'react'
import { AuthProvider, useAuth } from '@/auth/AuthProvider'
import type { AuthApi, AuthUser } from '@/auth/authApi'
import { LoginScreen } from '@/auth/LoginScreen'
import { NoAccessScreen } from '@/auth/NoAccessScreen'
import { CardsScreen } from '@/cards/CardsScreen'
import type { CategoriesApi, CategoriesSource } from '@/categories/categoriesApi'
import { CategoriesScreen } from '@/categories/CategoriesScreen'
import { useCategories } from '@/categories/useCategories'
import type { CardsApi, CardsSource } from '@/cards/cardsApi'
import { useCards } from '@/cards/useCards'
import { Button } from '@/components/ui/button'
import { BalanceSkeleton, CardsSkeleton, ClosedCardsSkeleton, HomeSkeleton, PageSkeleton, PeriodSkeleton } from '@/components/LoadingSkeletons'
import { merchantKey } from '@/merchants/merchantKey'
import type { MerchantsApi, MerchantsSource } from '@/merchants/merchantsApi'
import { useMerchants } from '@/merchants/useMerchants'
import { needsCategory } from '@/merchants/ToCategorize'
import type { EntriesApi, EntriesSource, EntryKind } from '@/money/entries'
import { BalanceScreen } from '@/balance/BalanceScreen'
import type { RatesApi, RatesSource } from '@/balance/ratesApi'
import { BudgetScreen, type BudgetSection } from '@/budget/BudgetScreen'
import type { CapsApi, CapsSource } from '@/home/capsApi'
import { HomeScreen } from '@/home/HomeScreen'
import { HistoryScreen } from '@/history/HistoryScreen'
import type { FixedApi, FixedSource } from '@/fixed/fixedApi'
import { useFixed } from '@/fixed/useFixed'
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import { MonthExpenses } from '@/expenses/MonthExpenses'
import { ScrollableTabsList } from '@/expenses/ScrollableTabsList'
import type { ExpensesSource } from '@/expenses/expensesSource'
import { useExpenses } from '@/expenses/useExpenses'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'

type AppProps = {
  authApi: AuthApi
  createExpensesSource: () => ExpensesSource
  createCardsSource: () => CardsSource
  createCardsApi: () => CardsApi
  createCategoriesSource: () => CategoriesSource
  createCategoriesApi: () => CategoriesApi
  createEntriesSource: (kind: EntryKind) => EntriesSource
  createEntriesApi: (kind: EntryKind) => EntriesApi
  createMerchantsApi: () => MerchantsApi
  createMerchantsSource: () => MerchantsSource
  createFixedSource: () => FixedSource
  createFixedApi: () => FixedApi
  createRatesSource: () => RatesSource
  createRatesApi: () => RatesApi
  createCapsSource: () => CapsSource
  createCapsApi: () => CapsApi
}

export default function App({
  authApi,
  createExpensesSource,
  createCardsSource,
  createCardsApi,
  createCategoriesSource,
  createCategoriesApi,
  createEntriesSource,
  createEntriesApi,
  createMerchantsApi,
  createMerchantsSource,
  createFixedSource,
  createFixedApi,
  createRatesSource,
  createRatesApi,
  createCapsSource,
  createCapsApi,
}: AppProps) {
  return (
    <AuthProvider api={authApi}>
      <Screens
        createExpensesSource={createExpensesSource}
        createCardsSource={createCardsSource}
        createCardsApi={createCardsApi}
        createCategoriesSource={createCategoriesSource}
        createCategoriesApi={createCategoriesApi}
        createEntriesSource={createEntriesSource}
        createEntriesApi={createEntriesApi}
        createMerchantsApi={createMerchantsApi}
        createMerchantsSource={createMerchantsSource}
        createFixedSource={createFixedSource}
        createFixedApi={createFixedApi}
        createRatesSource={createRatesSource}
        createRatesApi={createRatesApi}
        createCapsSource={createCapsSource}
        createCapsApi={createCapsApi}
      />
    </AuthProvider>
  )
}

function Screens({
  createExpensesSource,
  createCardsSource,
  createCardsApi,
  createCategoriesSource,
  createCategoriesApi,
  createEntriesSource,
  createEntriesApi,
  createMerchantsApi,
  createMerchantsSource,
  createFixedSource,
  createFixedApi,
  createRatesSource,
  createRatesApi,
  createCapsSource,
  createCapsApi,
}: Pick<
  AppProps,
  | 'createExpensesSource'
  | 'createCardsSource'
  | 'createCardsApi'
  | 'createCategoriesSource'
  | 'createCategoriesApi'
  | 'createEntriesSource'
  | 'createEntriesApi'
  | 'createMerchantsApi'
  | 'createMerchantsSource'
  | 'createFixedSource'
  | 'createFixedApi'
  | 'createRatesSource'
  | 'createRatesApi'
  | 'createCapsSource'
  | 'createCapsApi'
>) {
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
      // Only this branch creates the sources and the api, so nothing is read before authorization.
      return (
        <Authorized
          user={state.user}
          createExpensesSource={createExpensesSource}
          createCardsSource={createCardsSource}
          createCardsApi={createCardsApi}
          createCategoriesSource={createCategoriesSource}
          createCategoriesApi={createCategoriesApi}
          createEntriesSource={createEntriesSource}
          createEntriesApi={createEntriesApi}
          createMerchantsApi={createMerchantsApi}
          createMerchantsSource={createMerchantsSource}
          createFixedSource={createFixedSource}
          createFixedApi={createFixedApi}
          createRatesSource={createRatesSource}
          createRatesApi={createRatesApi}
          createCapsSource={createCapsSource}
          createCapsApi={createCapsApi}
          onSignOut={() => void signOut()}
        />
      )
  }
}

function Authorized({
  user,
  createExpensesSource,
  createCardsSource,
  createCardsApi,
  createCategoriesSource,
  createCategoriesApi,
  createEntriesSource,
  createEntriesApi,
  createMerchantsApi,
  createMerchantsSource,
  createFixedSource,
  createFixedApi,
  createRatesSource,
  createRatesApi,
  createCapsSource,
  createCapsApi,
  onSignOut,
}: Pick<
  AppProps,
  | 'createExpensesSource'
  | 'createCardsSource'
  | 'createCardsApi'
  | 'createCategoriesSource'
  | 'createCategoriesApi'
  | 'createEntriesSource'
  | 'createEntriesApi'
  | 'createMerchantsApi'
  | 'createMerchantsSource'
  | 'createFixedSource'
  | 'createFixedApi'
  | 'createRatesSource'
  | 'createRatesApi'
  | 'createCapsSource'
  | 'createCapsApi'
> & {
  user: AuthUser
  onSignOut: () => void
}) {
  const [source] = useState(createExpensesSource)
  // Created once so switching tabs never recreates them. Both subscriptions live here, shared by
  // the Gastos and Tarjetas tabs, and only exist once the user is authorized.
  const [cardsSource] = useState(createCardsSource)
  const [cardsApi] = useState(createCardsApi)
  const { status, expenses, error } = useExpenses(source)
  const cards = useCards(cardsSource)
  const [categoriesSource] = useState(createCategoriesSource)
  const [categoriesApi] = useState(createCategoriesApi)
  const categories = useCategories(categoriesSource)
  // The four sources/apis of incomes and savings are created once, so switching tabs never recreates them.
  const [incomesSource] = useState(() => createEntriesSource('incomes'))
  const [incomesApi] = useState(() => createEntriesApi('incomes'))
  const [savingsSource] = useState(() => createEntriesSource('savings'))
  const [savingsApi] = useState(() => createEntriesApi('savings'))
  const [merchantsApi] = useState(createMerchantsApi)
  const [merchantsSource] = useState(createMerchantsSource)
  const merchants = useMerchants(merchantsSource)
  const [fixedSource] = useState(createFixedSource)
  const [fixedApi] = useState(createFixedApi)
  const fixed = useFixed(fixedSource)
  const [ratesSource] = useState(createRatesSource)
  const [ratesApi] = useState(createRatesApi)
  const [capsSource] = useState(createCapsSource)
  const [capsApi] = useState(createCapsApi)
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
  const [categorySaveFailed, setCategorySaveFailed] = useState(false)
  // From "Compras a categorizar": also remember the choice for the merchant (for its future purchases)
  // and apply it to the other pending purchases of the same merchant.
  const categorize = (expenseId: string, categoryId: string | null) => {
    const expense = expenses.find((e) => e.id === expenseId)
    if (!expense || !categoryId) return changeCategory(expenseId, categoryId)
    setCategorySaveFailed(false)
    const key = merchantKey(expense.merchant)
    const same = expenses.filter((e) => e.id !== expenseId && key !== '' && merchantKey(e.merchant) === key && needsCategory(e, categories.categories))
    Promise.all([
      categoriesApi.setExpenseCategory(expenseId, categoryId),
      merchantsApi.remember(expense.merchant, categoryId),
      ...same.map((e) => categoriesApi.setExpenseCategory(e.id, categoryId)),
    ]).catch(() => setCategorySaveFailed(true))
  }
  const changeCategory = (expenseId: string, categoryId: string | null) => {
    setCategorySaveFailed(false)
    categoriesApi.setExpenseCategory(expenseId, categoryId).catch(() => setCategorySaveFailed(true))
  }

  return (
    <div className="mx-auto min-w-0 max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">{strings.appName}</h1>
        <div className="flex items-center gap-2">
          {user.photoURL && <img src={user.photoURL} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />}
          <span className="text-sm text-muted-foreground">{user.displayName ?? user.email}</span>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            {strings.header.signOut}
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
        {/* The tabs do not fit a phone: the strip scrolls sideways, with arrows. */}
        <ScrollableTabsList>
          <TabsTrigger value="home">{strings.tabs.home}</TabsTrigger>
          <TabsTrigger value="expenses">{strings.tabs.expenses}</TabsTrigger>
          <TabsTrigger value="cards">{strings.tabs.cards}</TabsTrigger>
          <TabsTrigger value="categories">{strings.tabs.categories}</TabsTrigger>
          <TabsTrigger value="budget">{strings.tabs.budget}</TabsTrigger>
          <TabsTrigger value="balance">{strings.tabs.balance}</TabsTrigger>
        </ScrollableTabsList>
        <TabsContent value="home">
          {status === 'error' || cards.status === 'error' || fixed.status === 'error' || categories.status === 'error' ? (
            <p role="alert" className="py-8 text-center text-destructive">
              {status === 'error' ? error : cards.status === 'error' ? cards.error : fixed.status === 'error' ? fixed.error : categories.error}
            </p>
          ) : status === 'loading' || cards.status === 'loading' || fixed.status === 'loading' || categories.status === 'loading' ? (
            <HomeSkeleton />
          ) : (
            <>
              {categorySaveFailed && (
                <p role="alert" className="mb-3 rounded-md border border-destructive p-3 text-destructive">
                  {strings.categories.saveError}
                </p>
              )}
              <HomeScreen
                expenses={expenses}
                cards={cards.data}
                fixed={fixed.data}
                categories={categories.categories}
                incomesSource={incomesSource}
                capsSource={capsSource}
                onCategoryChange={changeCategory}
                onNavigate={goTo}
              />
            </>
          )}
        </TabsContent>
        <TabsContent value="expenses">
          {status === 'error' || cards.status === 'error' || categories.status === 'error' ? (
            <p role="alert" className="py-8 text-center text-destructive">
              {status === 'error' ? error : cards.status === 'error' ? cards.error : categories.error}
            </p>
          ) : status === 'loading' || cards.status === 'loading' || categories.status === 'loading' ? (
            <PeriodSkeleton />
          ) : (
            <>
              {categorySaveFailed && (
                <p role="alert" className="mb-3 rounded-md border border-destructive p-3 text-destructive">
                  {strings.categories.saveError}
                </p>
              )}
              <MonthExpenses
                expenses={expenses}
                cards={cards.data}
                categories={categories.categories}
                onCategoryChange={changeCategory}
                capsSource={capsSource}
              />
            </>
          )}
        </TabsContent>
        <TabsContent value="cards">
          <CardsTab state={cards} api={cardsApi} expenses={expenses} expensesStatus={status} />
        </TabsContent>
        <TabsContent value="categories">
          {categories.status === 'loading' || status === 'loading' ? (
            <ClosedCardsSkeleton count={3} />
          ) : categories.status === 'error' || status === 'error' ? (
            <p role="alert" className="py-8 text-center text-destructive">
              {categories.status === 'error' ? categories.error : error}
            </p>
          ) : (
            <>
              {categorySaveFailed && (
                <p role="alert" className="mb-3 rounded-md border border-destructive p-3 text-destructive">
                  {strings.categories.saveError}
                </p>
              )}
              <CategoriesScreen
                expenses={expenses}
                categories={categories.categories}
                api={categoriesApi}
                merchants={merchants}
                merchantsApi={merchantsApi}
                onCategorize={categorize}
                initialOpen={openSection === 'toCategorize' ? 'toCategorize' : null}
              />
            </>
          )}
        </TabsContent>
        <TabsContent value="budget">
          <BudgetScreen
            fixed={fixed}
            fixedApi={fixedApi}
            incomesSource={incomesSource}
            incomesApi={incomesApi}
            savingsSource={savingsSource}
            savingsApi={savingsApi}
            capsSource={capsSource}
            capsApi={capsApi}
            initialOpen={(openSection as BudgetSection | null) ?? null}
          />
        </TabsContent>
        <TabsContent value="balance">
          {status === 'error' || cards.status === 'error' || fixed.status === 'error' ? (
            <p role="alert" className="py-8 text-center text-destructive">
              {status === 'error' ? error : cards.status === 'error' ? cards.error : fixed.error}
            </p>
          ) : status === 'loading' || cards.status === 'loading' || fixed.status === 'loading' ? (
            <BalanceSkeleton />
          ) : (
            <div className="grid gap-4">
              <BalanceScreen
                expenses={expenses}
                cards={cards.data}
                fixed={fixed.data}
                incomesSource={incomesSource}
                savingsSource={savingsSource}
                ratesSource={ratesSource}
                ratesApi={ratesApi}
              />
              <HistoryScreen
                expenses={expenses}
                cards={cards.data}
                fixed={fixed.data}
                incomesSource={incomesSource}
                savingsSource={savingsSource}
                ratesSource={ratesSource}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CardsTab({
  state,
  api,
  expenses,
  expensesStatus,
}: {
  state: ReturnType<typeof useCards>
  api: CardsApi
  expenses: Expense[]
  expensesStatus: 'loading' | 'ready' | 'error'
}) {
  const { status, data, error } = state
  if (status === 'loading') return <CardsSkeleton />
  if (status === 'error')
    return (
      <p role="alert" className="py-8 text-center text-destructive">
        {error}
      </p>
    )
  return <CardsScreen expenses={expenses} expensesStatus={expensesStatus} data={data} api={api} />
}
