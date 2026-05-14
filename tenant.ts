import { db } from "./firebase";
import { collection, doc } from "firebase/firestore";

export const getTenantCollection = (colName: string, user: any) => {
  if (!user) return collection(db, "unauthenticated_requests");
  
  // We now move everything to subcollections for everyone to ensure data isolation.
  // Each user (Admin or Employee) will have their own data under users/{uid}/{colName}
  return collection(db, "users", user.uid, colName);
};

export const getTenantDoc = (colName: string, docId: string, user: any) => {
  if (!user) return doc(db, "unauthenticated_requests", docId);
  
  return doc(db, "users", user.uid, colName, docId);
};
