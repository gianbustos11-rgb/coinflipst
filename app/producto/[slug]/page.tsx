import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { Product, ProductVariant } from '@/types/db';
import { ProductDetailClient } from './ProductDetailClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://coinflipst.com';

async function getProduct(slug: string): Promise<Product | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();
  return (data as unknown as Product) || null;
}

async function getVariants(productId: string): Promise<ProductVariant[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('size', { ascending: true });
  return (data || []) as unknown as ProductVariant[];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return {};

  const title = product.title;
  const fullTitle = `${product.title} | Coinflip`;
  const description =
    product.description ||
    `Comprá ${product.title} 100% original en Coinflip. Envíos a todo el país, pagá con transferencia o efectivo.`;
  const image = product.images?.[0]?.url;
  const url = `${SITE_URL}/producto/${product.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      type: 'website',
      images: image ? [{ url: image }] : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: image ? [image] : undefined
    }
  };
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const variants = await getVariants(product.id);
  const url = `${SITE_URL}/producto/${product.slug}`;
  const inStock = variants.some((v) => v.stock > 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description || undefined,
    image: product.images?.map((img) => img.url),
    url,
    brand: { '@type': 'Brand', name: 'Coinflip' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'USD',
      price: Number(product.price).toFixed(2),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock'
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient product={product} variants={variants} />
    </>
  );
}
