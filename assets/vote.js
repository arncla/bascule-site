// Votes du site : mêmes collections et mêmes règles que l'app (FirestoreVoteService.swift).
// - votes/{uid}_{dilemmaId} : dilemmaId, choice, ts ;
// - dilemmas/{id}/shards/{0..7} : compteurs a et b.
// Firebase n'est chargé qu'au premier besoin (vote, ou lecture d'un résultat déjà voté), jamais à l'ouverture.
import { FIREBASE } from "./config.js";

const SHARDS = 8;
let sdk = null;
let ctx = null;

export const isOpen = () => FIREBASE !== null;

export class AlreadyVoted extends Error {}

async function context() {
  if (ctx) return ctx;
  if (!FIREBASE) throw new Error("vote fermé");
  sdk = await import("./vendor/firebase.js");
  const app = sdk.initializeApp(FIREBASE);
  const auth = sdk.initializeAuth(app, {
    persistence: [sdk.indexedDBLocalPersistence, sdk.browserLocalPersistence],
  });
  ctx = { auth, db: sdk.getFirestore(app) };
  return ctx;
}

/// Connexion anonyme au premier vote, comme dans l'app.
async function uid() {
  const { auth } = await context();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await sdk.signInAnonymously(auth);
  return cred.user.uid;
}

export async function submit(dilemmaId, choice) {
  const id = await uid();
  const { db } = ctx;
  const shard = String(Math.floor(Math.random() * SHARDS));
  const batch = sdk.writeBatch(db);
  batch.set(sdk.doc(db, "votes", `${id}_${dilemmaId}`), {
    dilemmaId,
    choice,
    ts: sdk.serverTimestamp(),
  });
  batch.set(sdk.doc(db, "dilemmas", dilemmaId, "shards", shard), { [choice]: sdk.increment(1) }, { merge: true });
  try {
    await batch.commit();
  } catch (error) {
    // Les règles refusent un second vote du même utilisateur anonyme sur le même dilemme.
    if (error && error.code === "permission-denied") throw new AlreadyVoted();
    throw error;
  }
  return fetchResult(dilemmaId);
}

/// Somme des 8 shards. Lecture publique, sans connexion.
export async function fetchResult(dilemmaId) {
  const { db } = await context();
  const snap = await sdk.getDocs(sdk.collection(db, "dilemmas", dilemmaId, "shards"));
  let a = 0;
  let b = 0;
  snap.forEach((d) => {
    const data = d.data();
    a += Number(data.a) || 0;
    b += Number(data.b) || 0;
  });
  return { a, b };
}
