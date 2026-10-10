"use client";

import { useParams, useSearchParams } from "next/navigation";

import PrivateTextView from "../../../components/viewer/PrivateTextView";

export default function PrivateTextPage() {
  const { index } = useParams<{ index: string }>();
  const c = useSearchParams().get("chunk");
  return <PrivateTextView index={Number(index)} chunk={c === null ? null : Number(c)} />;
}
