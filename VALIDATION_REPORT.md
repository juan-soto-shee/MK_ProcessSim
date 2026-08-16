# MK ProcessSim — Informe de validación

Fecha: 2026-08-15

## Resultado

El circuito incorpora balances dinámicos explícitos de sólidos y agua, propiedades de pulpa, inventarios reales de molino y sump, bomba limitada y clasificación de ciclón. Resultado final de la suite: **48 PASS / 0 FAIL**.

Los resultados numéricos completos, valores esperados, errores y tolerancias están en `TEST_RESULTS.json`. Las ecuaciones y su clasificación están en `MODEL_DOCUMENTATION.md`.

## Arquitectura implementada

`alimentación fresca + agua molino + underflow → molino → sump + agua sump → bomba → ciclones → overflow + underflow`

Estados dinámicos:

- masa de sólidos por 20 clases en molino;
- inventario de agua del molino;
- masa de sólidos por 20 clases en sump;
- inventario de agua del sump.

La interfaz y el motor permanecen separados en `ui.js` y `engine.js`.

## Auditoría previa

Antes de esta ampliación, el sump y la bomba eran solo elementos gráficos; el ciclón recibía directamente la descarga del molino; no existían agua, densidad, % sólidos, caudal volumétrico, nivel, presión operativa ni residuos de agua. El antiguo estado estacionario no podía representar acumulación en sump.

## Caso base estacionario

Entradas principales: 100 t/h de sólidos frescos, F80 10 000 µm, Wi 14 kWh/t, 60 m³/h de agua al molino, 20 m³/h al sump, densidad mineral 2,7 t/m³, sump 160 m³, bomba 360 m³/h a 70 %, seis ciclones, 100 kPa y d50 base 105 µm.

Resultados aproximados:

| Variable | Resultado |
|---|---:|
| Overflow sólidos | 99,999 t/h |
| Underflow sólidos | 234,203 t/h |
| Carga circulante | 234,203 % |
| P80 overflow | 102,444 µm |
| Nivel sump | 56,166 % |
| Caudal bomba/ciclones | 285,581 m³/h |
| Densidad feed ciclón | 1,7368 t/m³ |
| Agua overflow | ≈83,09 m³/h |
| Residual sistema sólidos | <10⁻12 t/h |
| Residual sistema agua | <10⁻12 t/h |

## Pruebas

Se verificaron:

- balances de sólidos de sistema y ciclón;
- balances de agua en molino, sump, ciclón y sistema;
- densidad, porcentaje de sólidos y caudal volumétrico;
- inventario y nivel del sump;
- límite de caudal de bomba;
- split volumétrico del ciclón;
- definición de carga circulante;
- ausencia de deriva desde estado estacionario;
- convergencia de arranque en P80, CL, nivel y densidad;
- escalones de agua al molino, agua al sump, bomba, ciclones activos, presión, Wi y feed;
- independencia para dt 0,1/0,5/1/2 s;
- independencia para 1×/5×/10×/20× al mismo tiempo simulado;
- interpolación P80.

## Conservación crítica de 60 minutos

Se integraron entradas, salidas y cambio de inventarios durante 60 minutos simulados.

| Conservación | Residual acumulado | Tolerancia | Estado |
|---|---:|---:|---|
| Sólidos | ≈2,05·10⁻12 t | 0,002 t | PASS |
| Agua | ≈−4,19·10⁻13 t | 0,002 t | PASS |

## Detector de estabilidad

Incluye tasas de P80 overflow, CL, inventario de molino, nivel de sump, densidad de ciclón y FUF. Se exige cumplimiento continuo durante 2 minutos y cierre de sólidos/agua.

## Interfaz

Se agregaron entradas de densidad/humedad, agua molino, sump, bomba, presión y geometría de ciclones; resultados de agua/pulpa/nivel; alarmas de sump; perturbaciones nuevas; datos en vivo sobre el flowsheet; gráficos de nivel, pulpa y agua; y exportaciones CSV.

## Clasificación de modelos

| Componente | Estado |
|---|---|
| Balance de sólidos | IMPLEMENTADO y VERIFICADO MATEMÁTICAMENTE |
| Balance de agua | IMPLEMENTADO y VERIFICADO MATEMÁTICAMENTE |
| Propiedades de pulpa | IMPLEMENTADO y VERIFICADO MATEMÁTICAMENTE |
| Integración y conservación | VERIFICADO NUMÉRICAMENTE |
| Cinética de molienda | IMPLEMENTADA; EMPÍRICA/CALIBRABLE |
| Bomba | IMPLEMENTADA; PROVISIONAL |
| Corrección d50 por operación/geometría | IMPLEMENTADA; PROVISIONAL/CALIBRABLE |
| Recuperación de agua UF | IMPLEMENTADA; PROVISIONAL/CALIBRABLE |
| Validación contra planta | NO REALIZADA |
| Validación contra software comercial | NO REALIZADA |

## Limitaciones

No existe aún una curva bomba–sistema, modelo hidráulico de presión, correlación de diseño de ciclón validada, reología de pulpa, balance térmico, desgaste ni control PI con dinámica de actuador. Las alarmas no descargan rebalse automáticamente para evitar ocultar pérdidas de masa. Los parámetros empíricos requieren calibración con survey y pruebas de laboratorio.
