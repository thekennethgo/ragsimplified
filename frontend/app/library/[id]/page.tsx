"use client";

import { useParams, useSearchParams } from "next/navigation";

import LibraryDocView from "../../../components/viewer/LibraryDocView";

export default function LibraryDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const c = useSearchParams().get("chunk");
  return <LibraryDocView id={Number(id)} chunk={c === null ? null : Number(c)} />;
}
