# Prompt · Juntar los briefs que son el mismo territorio

> Este fichero **es** el prompt. Se edita aquí, no en el código.
> Lee `DECISIONES.md` antes de tocarlo.

Recibes los briefs que se sacaron de los documentos del mes. Tu trabajo es
decir **cuáles son en realidad el mismo territorio**, para juntarlos.

No escribes texto, no resumes, no decides qué material vale. Solo
agrupas.

## Por qué existe este paso

Los documentos se leen por trozos, y el mismo territorio aparece en
varias páginas. Cada vez que aparece, se le pone un nombre, y **el nombre
no sale igual**: «Ficción», «Ficción / Full Ficción» y «Desarrollo
Ficción» son la misma cosa escrita de tres maneras.

Si se quedan separados, ese territorio llega partido en tres briefs a
medias. Después se generan entradas duplicadas, y dos campañas gemelas
acaban citando páginas distintas del mismo documento.

Juntarlos por el parecido del nombre sería frágil: «Fútbol captación» y
«Fútbol winback» se parecen mucho y son cosas distintas. **Se juntan por
lo que dicen dentro, no por cómo se llaman.**

## Regla 1 · El mismo territorio, no el mismo tema

Dos briefs van juntos cuando hablan del **mismo producto para el mismo
propósito**. No basta con que compartan producto.

Van juntos:
- «Ficción» y «Desarrollo Ficción», si los dos traen el argumentario de
  Ficción para desarrollar clientes.
- «MPA» y «MPA (Movistar Protege Alarmas)».
- «Multidispositivos» y «Multidispositivos (tablet)», si el segundo es el
  mismo material con un ejemplo más.

NO van juntos:
- «Fútbol captación» y «Fútbol winback»: mismo producto, propósitos
  opuestos. Uno le habla a quien no lo tiene y el otro a quien se fue.
- «Fibra Adicional» y «FTTR»: productos distintos aunque se vendan a la
  vez.
- Un brief de plantilla y uno de territorio que hablen de lo mismo:
  **esos se quedan separados siempre**, porque después se prefiere el de
  plantilla y hay que poder distinguirlos.

Ante la duda, **no juntes**. Dos briefs separados que eran uno es un
inconveniente; dos territorios fundidos en uno mezcla mensajes de
públicos distintos, y eso acaba en una pieza mal escrita.

## Regla 2 · El nombre del grupo es el territorio, a secas

Al grupo le pones el nombre más limpio de los que te llegan, o uno mejor
si ninguno lo está. El nombre es **el territorio**: el producto o el tema.

- Sí: «Ficción», «FTTR», «Fútbol winback», «Horecas».
- No: fechas («octubre», «puente 12-O»), coletillas entre paréntesis,
  titulares de campaña, ni el nombre del documento.

Es lo que va a leer una persona en la tarea, y lo que hace que el mes que
viene el mismo territorio se llame igual.

## Regla 3 · Un brief que no se junta con nadie es un grupo de uno

Lo normal es que la mayoría se queden solos. No fuerces agrupaciones para
que salga una lista más corta.

## Formato de salida

Solo un array JSON, sin texto alrededor y sin ```:

```
[
  { "nombre": "Ficción",
    "briefs": ["Ficción", "Ficción / Full Ficción", "Desarrollo Ficción"] },
  { "nombre": "Fútbol winback",
    "briefs": ["Winback fútbol"] }
]
```

- `nombre`: cómo se va a llamar el territorio a partir de ahora.
- `briefs`: los **títulos exactos**, tal y como te llegan, de los que van
  en ese grupo.

Todos los briefs que recibes tienen que aparecer en exactamente un grupo.
Ninguno se queda fuera y ninguno se repite.
