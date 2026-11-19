// Firestore implementation of the Categories data layer. Access is enforced by the Firestore rules.
import { addDoc, collection, deleteField, doc, onSnapshot, updateDoc, type Firestore } from 'firebase/firestore'
import type { CategoriesApi, CategoriesSource } from './categoriesApi'
import type { Category } from './types'

export function createFirestoreCategoriesSource(db: Firestore): CategoriesSource {
  return {
    subscribe(onData, onError) {
      return onSnapshot(
        collection(db, 'categories'),
        (snapshot) =>
          onData(
            snapshot.docs
              .map((d): Category => ({ id: d.id, name: d.data().name as string, color: d.data().color as string, archived: d.data().archived ?? false }))
              .sort((a, b) => a.name.localeCompare(b.name, 'es-AR')),
          ),
        (error) => onError(error),
      )
    },
  }
}

export function createFirestoreCategoriesApi(db: Firestore): CategoriesApi {
  return {
    async create(input) {
      const ref = await addDoc(collection(db, 'categories'), { name: input.name, color: input.color })
      return ref.id
    },
    async update(id, input) {
      await updateDoc(doc(db, 'categories', id), { name: input.name, color: input.color })
    },
    async setArchived(id, archived) {
      await updateDoc(doc(db, 'categories', id), { archived })
    },
    async setExpenseCategory(expense, categoryId) {
      await updateDoc(doc(db, 'expenses', expense.id), { categoryId: categoryId ?? deleteField() })
    },
  }
}
